"use client";

// Cross-device sync engine.
//
// Server layout for a vault (all end-to-end encrypted):
//   meta                  settings items, chat index, tombstones, image list
//   conv/<convId>         one chat, with image data removed
//   img/<convId>/<attId>  one image's data URL
//
// Each sync: stamp local changes -> fetch meta -> merge per item (newest
// wins, deletions win over older edits) -> move chats/images that changed ->
// write meta with If-Match so two devices can't clobber each other -> apply
// what came down to the local store.

import { create } from "zustand";
import { useStore } from "../store";
import type { Attachment, Conversation } from "../types";
import {
  deriveVault,
  digest,
  fromBase64,
  importKey,
  openJson,
  sealJson,
  stableStringify,
} from "./crypto";
import { mergeCollection, Stamp, StampMap, TombMap } from "./merge";

export const SETTINGS = [
  "providers",
  "presets",
  "snippets",
  "themes",
  "regexScripts",
  "personas",
] as const;
type SettingsKey = (typeof SETTINGS)[number];
type Coll = SettingsKey | "conversations";
const COLLS: Coll[] = [...SETTINGS, "conversations"];

interface RemoteMeta {
  v: 1;
  items: Record<SettingsKey, Record<string, Stamp & { d: any }>>;
  convs: StampMap;
  tomb: Record<Coll, TombMap>;
  images: string[];
}

interface LocalSync {
  vault: string;
  rawKey: string;
  track: Record<Coll, StampMap>;
  tomb: Record<Coll, TombMap>;
  /** Image refs ("convId/attId") known to be on the server. */
  images: string[];
  lastSync?: number;
}

const LOCAL_KEY = "flux-sync";
/** A message still marked streaming after this long was interrupted by a reload. */
const STALE_STREAM_MS = 10 * 60 * 1000;

// ---------- status (in-memory, drives the UI) ----------

export type SyncPhase = "off" | "idle" | "syncing" | "error";

export interface VaultSummary {
  chats: number;
  providers: number;
  personas: number;
  snippets: number;
  presets: number;
  images: number;
}

interface SyncStatus {
  phase: SyncPhase;
  lastSync?: number;
  error?: string;
  vault?: string;
  /** What the server holds after the last successful sync. */
  remote?: VaultSummary;
}

/** Short, shareable form of the vault id so two devices can be compared. */
export function vaultFingerprint(vault?: string) {
  return vault ? `${vault.slice(0, 4)}-${vault.slice(4, 8)}`.toUpperCase() : "";
}

export const useSyncStatus = create<SyncStatus>(() => ({ phase: "off" }));

// ---------- local persistence ----------

const emptyColls = <T>(make: () => T): Record<Coll, T> =>
  Object.fromEntries(COLLS.map((c) => [c, make()])) as Record<Coll, T>;

function loadLocal(): LocalSync | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LocalSync;
    if (!v.vault || !v.rawKey) return null;
    v.track = { ...emptyColls<StampMap>(() => ({})), ...v.track };
    v.tomb = { ...emptyColls<TombMap>(() => ({})), ...v.tomb };
    v.images ??= [];
    return v;
  } catch {
    return null;
  }
}

function saveLocal(v: LocalSync) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(v));
  } catch {
    /* quota: the next sync re-derives everything it needs */
  }
}

export function isSyncEnabled(): boolean {
  return loadLocal() !== null;
}

/** Call once on startup so the UI reflects whether sync is on. */
export function initSyncStatus() {
  const local = loadLocal();
  useSyncStatus.setState(
    local
      ? { phase: "idle", lastSync: local.lastSync, vault: local.vault, error: undefined }
      : { phase: "off", lastSync: undefined, vault: undefined, error: undefined }
  );
}

// ---------- hashing ----------

/** Conversation without device-local noise: image bytes and streaming flags. */
function portableConv(c: Conversation): Conversation {
  return {
    ...c,
    messages: c.messages.map((m) => {
      const { streaming: _s, ...rest } = m;
      return rest.attachments
        ? {
            ...rest,
            attachments: rest.attachments.map((a) => {
              const { dataUrl: _d, ...att } = a;
              return att as Attachment;
            }),
          }
        : rest;
    }),
  };
}

const hashCache = new WeakMap<object, string>();
async function hashOf(coll: Coll, item: any): Promise<string> {
  const hit = hashCache.get(item);
  if (hit) return hit;
  const h = await digest(
    stableStringify(coll === "conversations" ? portableConv(item) : item)
  );
  hashCache.set(item, h);
  return h;
}

function isBusy(c: Conversation, now: number) {
  return c.messages.some((m) => m.streaming && now - m.createdAt < STALE_STREAM_MS);
}

type Snapshot = Record<Coll, Map<string, any>>;

/**
 * Record what changed locally since the last sync: new or edited items get a
 * fresh timestamp, items that vanished get a tombstone. Empty chats and chats
 * that are mid-reply are left alone.
 */
async function stampLocal(local: LocalSync, now: number): Promise<Snapshot> {
  const state = useStore.getState();
  const snap = emptyColls(() => new Map<string, any>());
  for (const coll of COLLS) {
    const track = local.track[coll];
    const present = new Set<string>();
    for (const item of state[coll] as any[]) {
      present.add(item.id);
      if (coll === "conversations") {
        const c = item as Conversation;
        if (c.messages.length === 0 || isBusy(c, now)) continue;
      }
      snap[coll].set(item.id, item);
      const h = await hashOf(coll, item);
      if (track[item.id]?.h !== h) track[item.id] = { h, t: now };
    }
    for (const id of Object.keys(track)) {
      if (!present.has(id)) {
        delete track[id];
        local.tomb[coll][id] = now;
      }
    }
  }
  return snap;
}

// ---------- transport ----------

class ConflictError extends Error {
  constructor() {
    super("Another device kept saving at the same moment. Sync will retry shortly.");
  }
}

async function api(
  method: "GET" | "PUT" | "DELETE",
  vault: string,
  key: string,
  body?: Uint8Array,
  ifMatch?: string | null
): Promise<Response> {
  const res = await fetch(
    `/api/sync?vault=${vault}&key=${encodeURIComponent(key)}`,
    {
      method,
      body: body ? new Blob([body]) : undefined,
      headers: {
        ...(body ? { "Content-Type": "application/octet-stream" } : {}),
        ...(ifMatch ? { "X-Sync-Version": ifMatch } : {}),
      },
      cache: "no-store",
    }
  );
  if (res.status === 412) throw new ConflictError();
  if (!res.ok && !(method === "GET" && res.status === 404)) {
    let msg = `Sync request failed (${res.status}).`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res;
}

async function getSealed<T>(key: CryptoKey, vault: string, path: string) {
  const res = await api("GET", vault, path);
  if (res.status === 404) return null;
  const data = new Uint8Array(await res.arrayBuffer());
  return { value: await openJson<T>(key, path, data), etag: res.headers.get("x-sync-version") };
}

async function putSealed(
  key: CryptoKey,
  vault: string,
  path: string,
  value: unknown,
  ifMatch?: string | null
) {
  await api("PUT", vault, path, await sealJson(key, path, value), ifMatch);
}

/** Run tasks with limited parallelism. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    })
  );
}

function emptyMeta(): RemoteMeta {
  return {
    v: 1,
    items: Object.fromEntries(SETTINGS.map((s) => [s, {}])) as RemoteMeta["items"],
    convs: {},
    tomb: emptyColls<TombMap>(() => ({})),
    images: [],
  };
}

// ---------- one sync pass ----------

async function syncPass(
  local: LocalSync,
  key: CryptoKey,
  recover: boolean
): Promise<VaultSummary> {
  const now = Date.now();
  const snap = await stampLocal(local, now);
  const { vault } = local;

  const got = await getSealed<RemoteMeta>(key, vault, "meta");
  const remote = got?.value ?? emptyMeta();
  remote.tomb = { ...emptyColls<TombMap>(() => ({})), ...remote.tomb };
  for (const s of SETTINGS) remote.items[s] ??= {};

  const next = emptyMeta();
  const remoteImages = new Set(remote.images);
  const pulledSettings: Partial<Record<SettingsKey, any[]>> = {};
  const deleted: Partial<Record<Coll, string[]>> = {};
  const merges = {} as Record<Coll, ReturnType<typeof mergeCollection>>;

  for (const coll of COLLS) {
    const remoteStamps: StampMap =
      coll === "conversations"
        ? remote.convs
        : Object.fromEntries(
            Object.entries(remote.items[coll]).map(([id, v]) => [id, { h: v.h, t: v.t }])
          );
    const m = mergeCollection(
      local.track[coll],
      local.tomb[coll],
      remoteStamps,
      remote.tomb[coll],
      now
    );
    merges[coll] = m;
    next.tomb[coll] = m.tomb;
    deleted[coll] = m.deleteLocal;

    if (coll === "conversations") {
      next.convs = m.items;
    } else {
      for (const [id, stamp] of Object.entries(m.items)) {
        const fromRemote = m.pull.includes(id) || !snap[coll].has(id);
        const d = fromRemote ? remote.items[coll][id]?.d : snap[coll].get(id);
        if (d === undefined) continue;
        next.items[coll][id] = { ...stamp, d };
      }
      pulledSettings[coll] = m.pull
        .map((id) => remote.items[coll][id]?.d)
        .filter(Boolean);
    }
  }

  // Chats: upload ours that won, download theirs that won.
  const cm = merges.conversations;
  await pool(cm.push, 3, async (id) => {
    const conv = snap.conversations.get(id) as Conversation | undefined;
    if (conv) await putSealed(key, vault, `conv/${id}`, portableConv(conv));
  });
  const pulledConvs: Conversation[] = [];
  await pool(cm.pull, 3, async (id) => {
    const got = await getSealed<Conversation>(key, vault, `conv/${id}`);
    if (got) pulledConvs.push(got.value);
    else delete next.convs[id]; // index points at a missing chat; drop it
  });
  // Recovery: chats stored on the server but missing from the index (for
  // example, an index write that failed after the chats were uploaded).
  if (recover) {
    const res = await fetch(`/api/sync?vault=${vault}&list=1`, { cache: "no-store" });
    if (res.ok) {
      const { keys } = (await res.json()) as { keys: string[] };
      const tomb = next.tomb.conversations;
      const orphans = keys
        .filter((k) => k.startsWith("conv/"))
        .map((k) => k.slice(5))
        .filter((id) => !next.convs[id] && tomb[id] === undefined && !snap.conversations.has(id));
      await pool(orphans, 3, async (id) => {
        const got = await getSealed<Conversation>(key, vault, `conv/${id}`);
        if (!got?.value?.messages) return;
        const stamp = { h: await hashOf("conversations", got.value), t: got.value.updatedAt || now };
        next.convs[id] = stamp;
        cm.items[id] = stamp;
        pulledConvs.push(got.value);
      });
      for (const k of keys) {
        if (k.startsWith("img/") && next.convs[k.split("/")[1]]) remoteImages.add(k.slice(4));
      }
    }
  }

  await pool(cm.deleteRemote, 3, async (id) => {
    await api("DELETE", vault, `conv/${id}`);
  });
  const gone = new Set(cm.deleteRemote.concat(cm.deleteLocal));
  for (const ref of remoteImages) {
    if (gone.has(ref.split("/")[0])) remoteImages.delete(ref);
  }

  // Images: upload any we hold that the server doesn't have yet.
  const uploads: Array<{ ref: string; dataUrl: string }> = [];
  for (const [id, conv] of snap.conversations) {
    if (!next.convs[id]) continue;
    for (const m of (conv as Conversation).messages) {
      for (const a of m.attachments ?? []) {
        const ref = `${id}/${a.id}`;
        if (a.kind === "image" && a.dataUrl && !remoteImages.has(ref)) {
          uploads.push({ ref, dataUrl: a.dataUrl });
        }
      }
    }
  }
  await pool(uploads, 2, async ({ ref, dataUrl }) => {
    await putSealed(key, vault, `img/${ref}`, dataUrl);
    remoteImages.add(ref);
  });
  next.images = [...remoteImages].sort();

  // Publish the merged index, unless nothing changed.
  const changed =
    !got || stableStringify(next) !== stableStringify({ ...remote, images: [...remote.images].sort() });
  if (changed) await putSealed(key, vault, "meta", next, got?.etag);

  applyToStore(local, snap, merges, pulledSettings, pulledConvs, deleted);
  local.images = next.images;
  local.lastSync = Date.now();
  return {
    chats: Object.keys(next.convs).length,
    providers: Object.keys(next.items.providers).length,
    personas: Object.keys(next.items.personas).length,
    snippets: Object.keys(next.items.snippets).length,
    presets: Object.keys(next.items.presets).length,
    images: next.images.length,
  };
}

/** Write what came down into the app store, skipping anything edited meanwhile. */
function applyToStore(
  local: LocalSync,
  snap: Snapshot,
  merges: Record<Coll, ReturnType<typeof mergeCollection>>,
  pulledSettings: Partial<Record<SettingsKey, any[]>>,
  pulledConvs: Conversation[],
  deleted: Partial<Record<Coll, string[]>>
) {
  const state = useStore.getState();
  const patch: Record<string, any> = {};
  const now = Date.now();

  for (const coll of COLLS) {
    const m = merges[coll];
    const incoming =
      coll === "conversations" ? pulledConvs : (pulledSettings[coll] ?? []);
    const del = new Set(deleted[coll] ?? []);
    if (!incoming.length && !del.size) {
      local.tomb[coll] = m.tomb;
      continue;
    }

    let list = [...(state[coll] as any[])];
    const current = new Map(list.map((x) => [x.id, x]));
    // An item is safe to overwrite if it's unchanged since we stamped it.
    const untouched = (id: string) =>
      !current.has(id) || current.get(id) === snap[coll].get(id);

    for (const id of del) {
      if (!untouched(id)) continue;
      list = list.filter((x) => x.id !== id);
      delete local.track[coll][id];
    }
    for (const item of incoming) {
      const id = item.id as string;
      const existing = current.get(id);
      if (!untouched(id)) continue;
      if (coll === "conversations" && existing && isBusy(existing, now)) continue;

      let value = item;
      if (coll === "conversations" && existing) value = keepLocalImages(item, existing);
      const idx = list.findIndex((x) => x.id === id);
      if (idx >= 0) list[idx] = value;
      else list.unshift(value);
      local.track[coll][id] = m.items[id];
    }
    if (coll === "conversations") {
      list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }
    local.tomb[coll] = m.tomb;
    patch[coll] = list;
  }

  if (Object.keys(patch).length === 0) return;
  if (patch.conversations) {
    const convs = patch.conversations as Conversation[];
    if (!convs.some((c) => c.id === state.activeId)) {
      patch.activeId = convs[0]?.id ?? null;
    }
  }
  useStore.setState(patch);
}

/** Pulled chats arrive without image bytes; reuse any this device already has. */
function keepLocalImages(incoming: Conversation, existing: Conversation): Conversation {
  const have = new Map<string, string>();
  for (const m of existing.messages) {
    for (const a of m.attachments ?? []) if (a.dataUrl) have.set(a.id, a.dataUrl);
  }
  if (!have.size) return incoming;
  return {
    ...incoming,
    messages: incoming.messages.map((m) =>
      m.attachments
        ? {
            ...m,
            attachments: m.attachments.map((a) =>
              have.has(a.id) ? { ...a, dataUrl: have.get(a.id) } : a
            ),
          }
        : m
    ),
  };
}

// ---------- public API ----------

let running: Promise<void> | null = null;
let again = false;
let recoverNext = false;

/**
 * Sync now. Concurrent calls coalesce into one follow-up pass. `recover`
 * also scans the server for chats missing from the index (used when sync is
 * turned on and for "Sync now", not for the background loop).
 */
export function syncNow(opts: { recover?: boolean } = {}): Promise<void> {
  if (opts.recover) recoverNext = true;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await runOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function runOnce() {
  const local = loadLocal();
  if (!local) {
    useSyncStatus.setState({ phase: "off" });
    return;
  }
  useSyncStatus.setState({ phase: "syncing", vault: local.vault });
  try {
    const key = await importKey(fromBase64(local.rawKey));
    let remote: VaultSummary | undefined;
    const recover = recoverNext;
    recoverNext = false;
    for (let attempt = 0; ; attempt++) {
      try {
        remote = await syncPass(local, key, recover);
        break;
      } catch (e) {
        // Another device wrote meta between our read and write: go again.
        if (e instanceof ConflictError && attempt < 3) continue;
        throw e;
      }
    }
    // Sync may have been turned off while we were working.
    if (!loadLocal()) return;
    saveLocal(local);
    useSyncStatus.setState({ phase: "idle", lastSync: local.lastSync, error: undefined, remote });
  } catch (e: any) {
    if (!loadLocal()) return;
    saveLocal(local); // keep tombstones/stamps recorded so far
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    useSyncStatus.setState({
      phase: "error",
      error: offline ? "You're offline. Changes will sync when you reconnect." : e?.message || "Sync failed.",
    });
  }
}

/** Does a vault already exist for this passphrase? Also returns the derived keys. */
export async function probeVault(passphrase: string) {
  const keys = await deriveVault(passphrase);
  const res = await api("GET", keys.vaultId, "meta");
  if (res.status !== 404) {
    // Make sure it really opens with this key before calling it a match.
    await openJson(keys.key, "meta", new Uint8Array(await res.arrayBuffer()));
  }
  return { keys, exists: res.status !== 404 };
}

export async function enableSync(keys: { rawKey: string; vaultId: string }) {
  saveLocal({
    vault: keys.vaultId,
    rawKey: keys.rawKey,
    track: emptyColls<StampMap>(() => ({})),
    tomb: emptyColls<TombMap>(() => ({})),
    images: [],
  });
  useSyncStatus.setState({ phase: "idle", vault: keys.vaultId, error: undefined, remote: undefined });
  await syncNow({ recover: true });
}

/** Stop syncing on this device. Local data stays; server data stays. */
export function disableSync() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {}
  useSyncStatus.setState({
    phase: "off",
    lastSync: undefined,
    error: undefined,
    vault: undefined,
    remote: undefined,
  });
}

/** Delete everything in this vault from the server, then turn sync off here. */
export async function deleteRemoteVault() {
  const local = loadLocal();
  if (!local) return;
  await api("DELETE", local.vault, "all");
  disableSync();
}

export async function isServerConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/sync?status=1", { cache: "no-store" });
    return !!(await res.json()).configured;
  } catch {
    return false;
  }
}

// ---------- images on demand ----------

const imageInflight = new Set<string>();

/**
 * Fill in images for a chat that this device doesn't hold (they came from
 * another device, or were trimmed from browser storage). Written without
 * touching `updatedAt`, so it isn't treated as an edit.
 */
export async function hydrateImages(convId: string) {
  const local = loadLocal();
  if (!local || !local.images.length) return;
  const conv = useStore.getState().conversations.find((c) => c.id === convId);
  if (!conv) return;
  const known = new Set(local.images);
  const wanted: string[] = [];
  for (const m of conv.messages) {
    for (const a of m.attachments ?? []) {
      const ref = `${convId}/${a.id}`;
      if (a.kind === "image" && !a.dataUrl && known.has(ref) && !imageInflight.has(ref)) {
        wanted.push(ref);
      }
    }
  }
  if (!wanted.length) return;

  const key = await importKey(fromBase64(local.rawKey));
  wanted.forEach((r) => imageInflight.add(r));
  try {
    await pool(wanted, 3, async (ref) => {
      try {
        const got = await getSealed<string>(key, local.vault, `img/${ref}`);
        if (!got || typeof got.value !== "string") return;
        const attId = ref.split("/")[1];
        useStore.setState((s) => ({
          conversations: s.conversations.map((c) =>
            c.id !== convId
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.attachments?.some((a) => a.id === attId)
                      ? {
                          ...m,
                          attachments: m.attachments.map((a) =>
                            a.id === attId ? { ...a, dataUrl: got.value } : a
                          ),
                        }
                      : m
                  ),
                }
          ),
        }));
      } catch {
        /* leave the placeholder; next view retries */
      }
    });
  } finally {
    wanted.forEach((r) => imageInflight.delete(r));
  }
}
