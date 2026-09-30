// Pure merge logic for sync: last-write-wins per item, with tombstones so
// deletions propagate. Kept free of browser APIs so it's easy to test.

/** A content hash and the time that content was last changed. */
export interface Stamp {
  h: string;
  t: number;
}

export type StampMap = Record<string, Stamp>;
export type TombMap = Record<string, number>;

/** Tombstones older than this are forgotten. */
export const TOMB_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface MergeResult {
  /** Surviving items and the stamp of the winning version. */
  items: StampMap;
  tomb: TombMap;
  /** Remote version won and differs from ours: bring it down. */
  pull: string[];
  /** Our version won and differs from the server's: send it up. */
  push: string[];
  /** Deleted elsewhere (or here): remove locally. */
  deleteLocal: string[];
  /** Deleted, and the server still has a copy: remove it there. */
  deleteRemote: string[];
}

function pick(l: Stamp | undefined, r: Stamp | undefined): "l" | "r" | null {
  if (l && r) {
    if (l.t !== r.t) return l.t > r.t ? "l" : "r";
    if (l.h === r.h) return "r";
    return l.h > r.h ? "l" : "r"; // deterministic tie-break
  }
  return l ? "l" : r ? "r" : null;
}

export function mergeCollection(
  local: StampMap,
  localTomb: TombMap,
  remote: StampMap,
  remoteTomb: TombMap,
  now = Date.now()
): MergeResult {
  const out: MergeResult = {
    items: {},
    tomb: {},
    pull: [],
    push: [],
    deleteLocal: [],
    deleteRemote: [],
  };
  const ids = new Set([
    ...Object.keys(local),
    ...Object.keys(localTomb),
    ...Object.keys(remote),
    ...Object.keys(remoteTomb),
  ]);

  for (const id of ids) {
    const l = local[id];
    const r = remote[id];
    const lt = localTomb[id];
    const rt = remoteTomb[id];
    const deletedAt = lt === undefined ? rt : rt === undefined ? lt : Math.max(lt, rt);
    const side = pick(l, r);
    const winner = side === "l" ? l : side === "r" ? r : undefined;

    if (deletedAt !== undefined && (!winner || deletedAt >= winner.t)) {
      if (now - deletedAt < TOMB_TTL_MS) out.tomb[id] = deletedAt;
      if (l) out.deleteLocal.push(id);
      if (r) out.deleteRemote.push(id);
      continue;
    }
    if (!winner) continue;

    out.items[id] = winner;
    if (side === "r" && (!l || l.h !== r!.h)) out.pull.push(id);
    if (side === "l" && (!r || r.h !== l!.h)) out.push.push(id);
  }
  return out;
}
