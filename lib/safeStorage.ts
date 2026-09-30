// localStorage wrapper for the persisted store that never throws.
//
// localStorage is capped at ~5 MB per site. Chat images are the bulk of what
// we save, and once the quota is hit every write fails — which would silently
// stop providers/keys from saving too. On a quota error we drop image data from
// the saved copy of older messages (the images stay in memory for this session)
// and retry, so settings and keys always persist.

export type StorageNotice = "pruned" | "full";

/** Fired on window when saved history had to be trimmed, or nothing could be saved. */
export const STORAGE_EVENT = "flux-storage";

function isQuotaError(e: unknown): boolean {
  const err = e as { name?: string; code?: number; message?: string };
  return (
    err?.name === "QuotaExceededError" ||
    err?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err?.code === 22 ||
    err?.code === 1014 ||
    /quota/i.test(err?.message ?? "")
  );
}

let prunedNotified = false;

function notify(kind: StorageNotice) {
  // Once trimming starts it repeats on every save; say so only once.
  if (kind === "pruned") {
    if (prunedNotified) return;
    prunedNotified = true;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: kind }));
  }
}

/**
 * Remove image data URLs from saved messages, keeping the `keep` most recent
 * image-bearing messages (by creation time) across all conversations.
 */
export function stripSavedImages(state: any, keep: number): boolean {
  const withImages: Array<{ createdAt: number; attachments: any[] }> = [];
  for (const conv of state?.conversations ?? []) {
    for (const msg of conv.messages ?? []) {
      if (msg.attachments?.some((a: any) => a.kind === "image" && a.dataUrl)) {
        withImages.push(msg);
      }
    }
  }
  withImages.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const toStrip = withImages.slice(0, Math.max(0, withImages.length - keep));
  for (const msg of toStrip) {
    msg.attachments = msg.attachments.map((a: any) =>
      a.kind === "image" && a.dataUrl ? { ...a, dataUrl: undefined } : a
    );
  }
  return toStrip.length > 0;
}

export const safeLocalStorage = {
  getItem(name: string): string | null {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  removeItem(name: string): void {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
  setItem(name: string, value: string): void {
    try {
      localStorage.setItem(name, value);
      return;
    } catch (e) {
      if (!isQuotaError(e)) {
        notify("full");
        return;
      }
    }

    let data: any;
    try {
      data = JSON.parse(value);
    } catch {
      notify("full");
      return;
    }

    // Keep the 2 most recent images, then none, then give up gracefully.
    for (const keep of [2, 0]) {
      if (!stripSavedImages(data.state, keep) && keep !== 0) continue;
      try {
        localStorage.setItem(name, JSON.stringify(data));
        notify("pruned");
        return;
      } catch (e) {
        if (!isQuotaError(e)) break;
      }
    }
    notify("full");
  },
};
