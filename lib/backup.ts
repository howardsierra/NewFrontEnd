// Versioned export/import of the user's whole setup so it can be backed up or
// moved between browsers/devices. Everything otherwise lives only in this
// browser's localStorage.

import type { ProviderConfig, Conversation } from "./types";
import type { SavedPreset, Snippet, SavedTheme, SavedRegex, SavedPersona } from "./store";

export const BACKUP_KIND = "newfrontend-backup";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  /** True if API keys (and custom headers) are included in this file. */
  includesKeys: boolean;
  providers: ProviderConfig[];
  presets: SavedPreset[];
  snippets: Snippet[];
  themes?: SavedTheme[];
  regexScripts?: SavedRegex[];
  personas?: SavedPersona[];
  conversations?: Conversation[];
}

interface BackupSource {
  providers: ProviderConfig[];
  presets: SavedPreset[];
  snippets: Snippet[];
  themes: SavedTheme[];
  regexScripts: SavedRegex[];
  personas: SavedPersona[];
  conversations: Conversation[];
}

export interface BackupOptions {
  includeKeys: boolean;
  includeConversations: boolean;
}

export function buildBackup(src: BackupSource, opts: BackupOptions): BackupFile {
  const providers = src.providers.map((p) =>
    opts.includeKeys ? { ...p } : { ...p, apiKey: "", headers: undefined }
  );
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    includesKeys: opts.includeKeys,
    providers,
    presets: src.presets,
    snippets: src.snippets,
    themes: src.themes,
    regexScripts: src.regexScripts,
    personas: src.personas,
    ...(opts.includeConversations ? { conversations: src.conversations } : {}),
  };
}

export function validateBackup(
  json: unknown
): { ok: true; data: BackupFile } | { ok: false; error: string } {
  if (!json || typeof json !== "object") {
    return { ok: false, error: "Not a valid backup file." };
  }
  const j = json as Record<string, unknown>;
  if (j.kind !== BACKUP_KIND) {
    return { ok: false, error: "This file isn't a Flux.AI backup." };
  }
  if (typeof j.version !== "number" || j.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version (${String(j.version)}). Update the app.`,
    };
  }
  if (
    !Array.isArray(j.providers) ||
    !Array.isArray(j.presets) ||
    !Array.isArray(j.snippets)
  ) {
    return { ok: false, error: "Backup is missing expected sections." };
  }
  return { ok: true, data: json as BackupFile };
}

export interface ImportSummary {
  providers: number;
  presets: number;
  snippets: number;
  themes: number;
  regexScripts: number;
  personas: number;
  conversations: number;
  skipped: number;
}

export function backupFilename(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `flux-ai-backup-${stamp}.json`;
}
