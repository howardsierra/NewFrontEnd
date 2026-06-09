"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import {
  Conversation,
  ProviderConfig,
  ChatMessage,
  GenerationParams,
  DEFAULT_PARAMS,
  ModelInfo,
} from "./types";
import { PresetDraft } from "./sillytavern";

export interface SavedPreset extends PresetDraft {
  id: string;
  updatedAt: number;
}

interface AppState {
  providers: ProviderConfig[];
  conversations: Conversation[];
  activeId: string | null;
  /** Cached model lists per provider id. Not persisted long-term but kept in memory. */
  modelCache: Record<string, ModelInfo[]>;
  presets: SavedPreset[];
  hydrated: boolean;

  // provider actions
  addProvider: (p: Omit<ProviderConfig, "id">) => string;
  updateProvider: (id: string, patch: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;

  // conversation actions
  newConversation: () => string;
  removeConversation: (id: string) => void;
  setActive: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setConversationProvider: (id: string, providerId: string | null, model: string | null) => void;
  setConversationModel: (id: string, model: string) => void;
  updateParams: (id: string, patch: Partial<GenerationParams>) => void;

  // message actions
  addMessage: (convId: string, msg: ChatMessage) => void;
  appendToMessage: (convId: string, msgId: string, chunk: string) => void;
  patchMessage: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (convId: string, msgId: string) => void;

  setModelCache: (providerId: string, models: ModelInfo[]) => void;

  // preset actions
  savePreset: (draft: PresetDraft, id?: string) => string;
  removePreset: (id: string) => void;
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
      hydrated: false,

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
    }),
    {
      name: "newfrontend-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        providers: s.providers,
        conversations: s.conversations,
        activeId: s.activeId,
        presets: s.presets,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
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
