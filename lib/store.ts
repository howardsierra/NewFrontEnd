"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { LibraryFile } from "./file-library";
import { branchConversation } from "./branch";
import {
  Conversation,
  ProviderConfig,
  ChatMessage,
  GenerationParams,
  DEFAULT_PARAMS,
  ModelInfo,
} from "./types";
import { PresetDraft } from "./sillytavern";
import { ThemeDraft } from "./sillytavern-theme";
import { RegexDraft } from "./sillytavern-regex";
import { PersonaDraft } from "./personas";
import type { BackupFile, ImportSummary } from "./backup";
import { safeLocalStorage } from "./safeStorage";

export interface SavedPreset extends PresetDraft {
  id: string;
  updatedAt: number;
}

export interface Snippet {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedTheme extends ThemeDraft {
  id: string;
  updatedAt: number;
}

export interface SavedRegex extends RegexDraft {
  id: string;
  updatedAt: number;
}

export interface SavedPersona extends PersonaDraft {
  id: string;
  updatedAt: number;
}

function libraryWasSaved(expected: LibraryFile[]): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = JSON.parse(window.localStorage.getItem("newfrontend-store") || "null");
    return JSON.stringify(saved?.state?.libraryFiles) === JSON.stringify(expected);
  } catch { return false; }
}

interface AppState {
  providers: ProviderConfig[];
  conversations: Conversation[];
  activeId: string | null;
  /** Cached model lists per provider id. Not persisted long-term but kept in memory. */
  modelCache: Record<string, ModelInfo[]>;
  presets: SavedPreset[];
  snippets: Snippet[];
  themes: SavedTheme[];
  regexScripts: SavedRegex[];
  personas: SavedPersona[];
  uiTheme: "dark" | "light";
  libraryFiles: LibraryFile[];
  keepLibraryFile: (file: LibraryFile) => void;
  saveFileVersion: (file: LibraryFile, filename: string, content: string, path?: string) => string;
  removeLibraryFile: (id: string) => void;
  hydrated: boolean;
  setHydrated: () => void;
  setUiTheme: (t: "dark" | "light") => void;

  // provider actions
  addProvider: (p: Omit<ProviderConfig, "id">) => string;
  updateProvider: (id: string, patch: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;

  // conversation actions
  newConversation: () => string;
  removeConversation: (id: string) => void;
  branchFromMessage: (convId: string, messageId: string, text: string) => string;
  setActive: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setConversationProvider: (id: string, providerId: string | null, model: string | null) => void;
  setConversationModel: (id: string, model: string) => void;
  updateParams: (id: string, patch: Partial<GenerationParams>) => void;

  // message actions
  addMessage: (convId: string, msg: ChatMessage) => void;
  appendToMessage: (convId: string, msgId: string, chunk: string) => void;
  appendReasoning: (convId: string, msgId: string, chunk: string) => void;
  patchMessage: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (convId: string, msgId: string) => void;

  setModelCache: (providerId: string, models: ModelInfo[]) => void;

  // preset actions
  savePreset: (draft: PresetDraft, id?: string) => string;
  removePreset: (id: string) => void;

  // snippet actions
  saveSnippet: (draft: { title: string; body: string }, id?: string) => string;
  removeSnippet: (id: string) => void;
  addSnippets: (items: Array<{ title: string; body: string }>) => void;

  // theme actions
  saveTheme: (draft: ThemeDraft, id?: string) => string;
  removeTheme: (id: string) => void;

  // regex actions
  saveRegex: (draft: RegexDraft, id?: string) => string;
  removeRegex: (id: string) => void;
  addRegexScripts: (items: RegexDraft[]) => void;

  // persona actions
  savePersona: (draft: PersonaDraft, id?: string) => string;
  removePersona: (id: string) => void;
  addPersonas: (items: PersonaDraft[]) => void;
  setConversationPersona: (convId: string, personaId: string | null) => void;

  // backup
  importBackup: (data: BackupFile, mode: "merge" | "replace") => ImportSummary;
}

function makeConversation(): Conversation {
  const now = Date.now();
  return {
    id: nanoid(),
    title: "New chat",
    messages: [],
    providerId: null,
    model: null,
    params: { ...DEFAULT_PARAMS },
    createdAt: now,
    updatedAt: now,
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      providers: [],
      conversations: [],
      activeId: null,
      modelCache: {},
      presets: [],
      snippets: [],
      themes: [],
      regexScripts: [],
      personas: [],
      uiTheme: "dark",
      libraryFiles: [],
      keepLibraryFile: (file) => {
        if (get().libraryFiles.some((item) => item.id === file.id)) return;
        const previous = get().libraryFiles;
        const next = [structuredClone(file), ...previous];
        if (new TextEncoder().encode(JSON.stringify(next)).byteLength > 2_000_000) throw new Error("Kept files and their versions exceed the 2 MB library limit. Download a backup or remove kept copies to make room.");
        set({ libraryFiles: next });
        if (!libraryWasSaved(next)) {
          set({ libraryFiles: previous });
          throw new Error("This browser could not save the file library. Download your file or a backup before closing this page.");
        }
      },
      saveFileVersion: (file, filename, content, path) => {
        const base = get().libraryFiles.find((item) => item.id === file.id) ?? file;
        const last = base.versions[base.versions.length - 1];
        if (last.filename === filename && last.content === content && last.path === path) return last.id;
        const id = nanoid();
        const now = Date.now();
        const updated = { ...base, updatedAt: now, versions: [...base.versions, { id, filename, content, createdAt: now, ...(path ? { path } : {}) }] };
        const previous = get().libraryFiles;
        const next = [updated, ...previous.filter((item) => item.id !== file.id)];
        if (new TextEncoder().encode(JSON.stringify(next)).byteLength > 2_000_000) throw new Error("Kept files and their versions exceed the 2 MB library limit. Download a backup or remove kept copies to make room.");
        set({ libraryFiles: next });
        if (!libraryWasSaved(next)) {
          set({ libraryFiles: previous });
          throw new Error("This browser could not save the file library. Download your file or a backup before closing this page.");
        }
        return id;
      },
      removeLibraryFile: (id) => set((state) => ({ libraryFiles: state.libraryFiles.filter((file) => file.id !== id) })),
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setUiTheme: (t) => set({ uiTheme: t }),

      addProvider: (p) => {
        const id = nanoid();
        set((s) => ({ providers: [...s.providers, { ...p, id }] }));
        return id;
      },
      updateProvider: (id, patch) =>
        set((s) => ({
          providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removeProvider: (id) =>
        set((s) => ({ providers: s.providers.filter((p) => p.id !== id) })),

      newConversation: () => {
        const conv = makeConversation();
        // Inherit provider/model from the current active conversation for convenience.
        const active = get().conversations.find((c) => c.id === get().activeId);
        if (active) {
          conv.providerId = active.providerId;
          conv.model = active.model;
          conv.personaId = active.personaId ?? null;
          conv.params = { ...active.params, systemPrompt: active.params.systemPrompt };
        } else {
          const first = get().providers.find((p) => p.enabled);
          if (first) {
            conv.providerId = first.id;
            conv.model = first.defaultModel ?? null;
          }
        }
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeId: conv.id,
        }));
        return conv.id;
      },
      branchFromMessage: (convId, messageId, text) => {
        const source = get().conversations.find((conversation) => conversation.id === convId);
        if (!source) throw new Error("Conversation not found.");
        const branch = branchConversation(source, messageId, text);
        set((state) => ({ conversations: [branch, ...state.conversations], activeId: branch.id }));
        return branch.id;
      },
      removeConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const activeId =
            s.activeId === id ? conversations[0]?.id ?? null : s.activeId;
          return { conversations, activeId };
        }),
      setActive: (id) => set({ activeId: id }),
      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        })),
      setConversationProvider: (id, providerId, model) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, providerId, model } : c
          ),
        })),
      setConversationModel: (id, model) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, model } : c
          ),
        })),
      updateParams: (id, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, params: { ...c.params, ...patch } } : c
          ),
        })),

      addMessage: (convId, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
              : c
          ),
        })),
      appendToMessage: (convId, msgId, chunk) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + chunk } : m
                  ),
                }
              : c
          ),
        })),
      appendReasoning: (convId, msgId, chunk) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, reasoning: (m.reasoning ?? "") + chunk } : m
                  ),
                }
              : c
          ),
        })),
      patchMessage: (convId, msgId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, ...patch } : m
                  ),
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),
      removeMessage: (convId, msgId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) }
              : c
          ),
        })),

      setModelCache: (providerId, models) =>
        set((s) => ({ modelCache: { ...s.modelCache, [providerId]: models } })),

      savePreset: (draft, id) => {
        const now = Date.now();
        if (id) {
          set((s) => ({
            presets: s.presets.map((p) =>
              p.id === id ? { ...draft, id, updatedAt: now } : p
            ),
          }));
          return id;
        }
        const newId = nanoid();
        set((s) => ({
          presets: [{ ...draft, id: newId, updatedAt: now }, ...s.presets],
        }));
        return newId;
      },
      removePreset: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),

      saveSnippet: (draft, id) => {
        const now = Date.now();
        if (id) {
          set((s) => ({
            snippets: s.snippets.map((sn) =>
              sn.id === id ? { ...sn, ...draft, updatedAt: now } : sn
            ),
          }));
          return id;
        }
        const newId = nanoid();
        set((s) => ({
          snippets: [
            { id: newId, title: draft.title, body: draft.body, createdAt: now, updatedAt: now },
            ...s.snippets,
          ],
        }));
        return newId;
      },
      importBackup: (data, mode) => {
        const summary: ImportSummary = {
          providers: 0,
          presets: 0,
          snippets: 0,
          themes: 0,
          regexScripts: 0,
          personas: 0,
          conversations: 0,
          libraryFiles: 0,
          skipped: 0,
        };

        if (mode === "replace") {
          const next: Partial<AppState> = {
            providers: data.providers,
            libraryFiles: data.libraryFiles ?? get().libraryFiles,
            presets: data.presets,
            snippets: data.snippets,
            themes: data.themes ?? [],
            regexScripts: data.regexScripts ?? [],
            personas: data.personas ?? [],
          };
          summary.libraryFiles = data.libraryFiles?.length ?? 0;
          summary.providers = data.providers.length;
          summary.presets = data.presets.length;
          summary.snippets = data.snippets.length;
          summary.themes = (data.themes ?? []).length;
          summary.regexScripts = (data.regexScripts ?? []).length;
          summary.personas = (data.personas ?? []).length;
          if (!data.conversations) {
            const current = get();
            next.conversations = current.conversations.map((conversation) => {
              const provider = current.providers.find((item) => item.id === conversation.providerId);
              const persona = current.personas.find((item) => item.id === conversation.personaId);
              return { ...conversation,
                providerId: provider ? data.providers.find((item) => item.kind === provider.kind && (item.baseUrl ?? "") === (provider.baseUrl ?? "") && item.label === provider.label)?.id ?? null : null,
                personaId: persona ? data.personas?.find((item) => item.name.toLowerCase() === persona.name.toLowerCase())?.id ?? null : null,
              };
            });
          }
          next.modelCache = {};
          if (data.conversations) {
            next.conversations = data.conversations;
            next.activeId = data.conversations[0]?.id ?? null;
            summary.conversations = data.conversations.length;
          }
          set(next as AppState);
          return summary;
        }

        // Merge: append only items not already present (by content signature).
        const state = get();
        const provSig = (p: ProviderConfig) =>
          `${p.kind}|${p.baseUrl ?? ""}|${p.label}`.toLowerCase();
        const existingProv = new Set(state.providers.map(provSig));
        const newProviders = data.providers.filter((p) => {
          if (existingProv.has(provSig(p))) {
            summary.skipped++;
            return false;
          }
          existingProv.add(provSig(p));
          summary.providers++;
          return true;
        });

        const existingPreset = new Set(
          state.presets.map((p) => p.name.toLowerCase())
        );
        const newPresets = data.presets.filter((p) => {
          if (existingPreset.has(p.name.toLowerCase())) {
            summary.skipped++;
            return false;
          }
          existingPreset.add(p.name.toLowerCase());
          summary.presets++;
          return true;
        });

        const snipSig = (s: Snippet) => `${s.title}|${s.body}`;
        const existingSnip = new Set(state.snippets.map(snipSig));
        const newSnippets = data.snippets.filter((s) => {
          if (existingSnip.has(snipSig(s))) {
            summary.skipped++;
            return false;
          }
          existingSnip.add(snipSig(s));
          summary.snippets++;
          return true;
        });

        const existingTheme = new Set(state.themes.map((t) => t.name.toLowerCase()));
        const newThemes = (data.themes ?? []).filter((t) => {
          if (existingTheme.has(t.name.toLowerCase())) {
            summary.skipped++;
            return false;
          }
          existingTheme.add(t.name.toLowerCase());
          summary.themes++;
          return true;
        });

        const existingRegex = new Set(state.regexScripts.map((r) => r.scriptName.toLowerCase()));
        const newRegex = (data.regexScripts ?? []).filter((r) => {
          if (existingRegex.has(r.scriptName.toLowerCase())) {
            summary.skipped++;
            return false;
          }
          existingRegex.add(r.scriptName.toLowerCase());
          summary.regexScripts++;
          return true;
        });

        const existingPersona = new Set(state.personas.map((p) => p.name.toLowerCase()));
        const newPersonas = (data.personas ?? []).filter((p) => {
          if (existingPersona.has(p.name.toLowerCase())) {
            summary.skipped++;
            return false;
          }
          existingPersona.add(p.name.toLowerCase());
          summary.personas++;
          return true;
        });

        // Regenerate ids on imported items to avoid collisions with existing.
        const reId = <T extends { id: string }>(arr: T[]): T[] =>
          arr.map((x) => ({ ...x, id: nanoid() }));

        const mergedProviders = [...state.providers, ...reId(newProviders)];
        const mergedPersonas = [...state.personas, ...reId(newPersonas)];
        const providerMap = new Map(data.providers.map((provider) => [provider.id, mergedProviders.find((item) => provSig(item) === provSig(provider))!.id]));
        const personaMap = new Map((data.personas ?? []).map((persona) => [persona.id, mergedPersonas.find((item) => item.name.toLowerCase() === persona.name.toLowerCase())!.id]));
        const libraryIds = new Set(state.libraryFiles.map((file) => file.id));
        const importedFiles = (data.libraryFiles ?? []).filter((file) => {
          if (libraryIds.has(file.id)) { summary.skipped++; return false; }
          libraryIds.add(file.id);
          return true;
        });
        summary.libraryFiles = importedFiles.length;
        const patch: Partial<AppState> = {
          libraryFiles: [...importedFiles, ...state.libraryFiles],
          providers: mergedProviders,
          presets: [...state.presets, ...reId(newPresets)],
          snippets: [...state.snippets, ...reId(newSnippets)],
          themes: [...state.themes, ...reId(newThemes)],
          regexScripts: [...state.regexScripts, ...reId(newRegex)],
          personas: mergedPersonas,
        };

        if (data.conversations?.length) {
          const existingConv = new Set(state.conversations.map((c) => c.id));
          const newConvs = data.conversations.filter((c) => {
            if (existingConv.has(c.id)) { summary.skipped++; return false; }
            existingConv.add(c.id);
            return true;
          }).map((conversation) => ({
            ...conversation,
            providerId: conversation.providerId ? providerMap.get(conversation.providerId) ?? (state.providers.some((provider) => provider.id === conversation.providerId) ? conversation.providerId : null) : null,
            personaId: conversation.personaId ? personaMap.get(conversation.personaId) ?? (state.personas.some((persona) => persona.id === conversation.personaId) ? conversation.personaId : null) : null,
          }));
          summary.conversations = newConvs.length;
          patch.conversations = [...newConvs, ...state.conversations];
        }

        set(patch as AppState);
        return summary;
      },
      removeSnippet: (id) =>
        set((s) => ({ snippets: s.snippets.filter((sn) => sn.id !== id) })),
      addSnippets: (items) => {
        const now = Date.now();
        set((s) => ({
          snippets: [
            ...items.map((it) => ({
              id: nanoid(),
              title: it.title,
              body: it.body,
              createdAt: now,
              updatedAt: now,
            })),
            ...s.snippets,
          ],
        }));
      },

      saveTheme: (draft, id) => {
        const now = Date.now();
        if (id) {
          set((s) => ({
            themes: s.themes.map((t) => (t.id === id ? { ...draft, id, updatedAt: now } : t)),
          }));
          return id;
        }
        const newId = nanoid();
        set((s) => ({ themes: [{ ...draft, id: newId, updatedAt: now }, ...s.themes] }));
        return newId;
      },
      removeTheme: (id) => set((s) => ({ themes: s.themes.filter((t) => t.id !== id) })),

      saveRegex: (draft, id) => {
        const now = Date.now();
        if (id) {
          set((s) => ({
            regexScripts: s.regexScripts.map((r) =>
              r.id === id ? { ...draft, id, updatedAt: now } : r
            ),
          }));
          return id;
        }
        const newId = nanoid();
        set((s) => ({
          regexScripts: [{ ...draft, id: newId, updatedAt: now }, ...s.regexScripts],
        }));
        return newId;
      },
      removeRegex: (id) =>
        set((s) => ({ regexScripts: s.regexScripts.filter((r) => r.id !== id) })),
      addRegexScripts: (items) => {
        const now = Date.now();
        set((s) => ({
          regexScripts: [
            ...items.map((it) => ({ ...it, id: nanoid(), updatedAt: now })),
            ...s.regexScripts,
          ],
        }));
      },

      savePersona: (draft, id) => {
        const now = Date.now();
        if (id) {
          set((s) => ({
            personas: s.personas.map((p) =>
              p.id === id ? { ...draft, id, updatedAt: now } : p
            ),
          }));
          return id;
        }
        const newId = nanoid();
        set((s) => ({ personas: [{ ...draft, id: newId, updatedAt: now }, ...s.personas] }));
        return newId;
      },
      removePersona: (id) =>
        set((s) => ({
          personas: s.personas.filter((p) => p.id !== id),
          // Detach from any conversation using it.
          conversations: s.conversations.map((c) =>
            c.personaId === id ? { ...c, personaId: null } : c
          ),
        })),
      addPersonas: (items) => {
        const now = Date.now();
        set((s) => ({
          personas: [
            ...items.map((it) => ({ ...it, id: nanoid(), updatedAt: now })),
            ...s.personas,
          ],
        }));
      },
      setConversationPersona: (convId, personaId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, personaId } : c
          ),
        })),
    }),
    {
      name: "newfrontend-store",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({
        providers: s.providers,
        conversations: s.conversations,
        activeId: s.activeId,
        presets: s.presets,
        snippets: s.snippets,
        themes: s.themes,
        regexScripts: s.regexScripts,
        personas: s.personas,
        uiTheme: s.uiTheme,
        libraryFiles: s.libraryFiles,
      }),
      onRehydrateStorage: () => (state) => {
        // Notify subscribers via an action (which calls set) — a direct
        // `state.hydrated = true` mutation does not trigger a re-render.
        state?.setHydrated();
      },
    }
  )
);

export function newMessage(
  role: ChatMessage["role"],
  content: string,
  extra?: Partial<ChatMessage>
): ChatMessage {
  return {
    id: nanoid(),
    role,
    content,
    createdAt: Date.now(),
    ...extra,
  };
}
