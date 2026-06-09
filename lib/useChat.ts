"use client";

import { useCallback, useRef, useState } from "react";
import { useStore, newMessage } from "./store";
import { attachmentToPrompt } from "./files";
import type { Attachment, ChatRequest, Conversation } from "./types";
import { PROVIDER_META } from "./providers";

/** Build the provider-agnostic message array from a conversation's history. */
function buildMessages(conv: Conversation): ChatRequest["messages"] {
  const out: ChatRequest["messages"] = [];
  if (conv.params.systemPrompt.trim()) {
    out.push({ role: "system", content: conv.params.systemPrompt.trim() });
  }
  for (const m of conv.messages) {
    if (m.role === "system" || m.error) continue;
    if (m.role === "assistant" && !m.content) continue; // skip empty placeholders
    let content = m.content;
    const images: string[] = [];
    if (m.attachments) {
      for (const a of m.attachments) {
        if (a.kind === "text") content += attachmentToPrompt(a);
        else if (a.kind === "image" && a.dataUrl) images.push(a.dataUrl);
      }
    }
    out.push({ role: m.role, content, ...(images.length ? { images } : {}) });
  }
  return out;
}

export function useChat() {
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Create an assistant placeholder and stream a completion for the given conversation. */
  const runCompletion = useCallback(async (convId: string) => {
    const state = useStore.getState();
    const conv = state.conversations.find((c) => c.id === convId);
    if (!conv) return;
    const provider = state.providers.find((p) => p.id === conv.providerId);
    if (!provider) {
      alert("Pick a provider and model first (top bar).");
      return;
    }
    if (!conv.model) {
      alert("Select a model first.");
      return;
    }

    const reqBody: ChatRequest = {
      kind: provider.kind,
      apiKey: provider.apiKey,
      baseUrl:
        provider.kind === "custom"
          ? provider.baseUrl
          : PROVIDER_META[provider.kind].baseUrl,
      model: conv.model,
      params: conv.params,
      messages: buildMessages(conv),
    };

    const assistant = newMessage("assistant", "", {
      streaming: true,
      model: conv.model,
      providerLabel: provider.label,
    });
    state.addMessage(convId, assistant);

    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let msg = `Request failed (${res.status}).`;
        try {
          const j = await res.json();
          if (j.error) msg = j.error;
        } catch {}
        useStore.getState().patchMessage(convId, assistant.id, {
          streaming: false,
          error: msg,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) useStore.getState().appendToMessage(convId, assistant.id, chunk);
      }
      useStore.getState().patchMessage(convId, assistant.id, { streaming: false });
    } catch (e: any) {
      const aborted = e?.name === "AbortError";
      const current = useStore
        .getState()
        .conversations.find((c) => c.id === convId)
        ?.messages.find((m) => m.id === assistant.id);
      useStore.getState().patchMessage(convId, assistant.id, {
        streaming: false,
        error: aborted
          ? current?.content
            ? undefined
            : "Stopped."
          : e?.message || "Network error.",
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, []);

  const send = useCallback(
    async (text: string, attachments: Attachment[]) => {
      const state = useStore.getState();
      const conv = state.conversations.find((c) => c.id === state.activeId);
      if (!conv) return;

      const userMsg = newMessage("user", text, {
        attachments: attachments.length ? attachments : undefined,
      });
      state.addMessage(conv.id, userMsg);

      if (conv.messages.length === 0 && conv.title === "New chat") {
        state.renameConversation(conv.id, text.slice(0, 48).trim() || "New chat");
      }

      await runCompletion(conv.id);
    },
    [runCompletion]
  );

  /** Remove the trailing assistant message (if any) and re-stream. */
  const regenerate = useCallback(async () => {
    const state = useStore.getState();
    const conv = state.conversations.find((c) => c.id === state.activeId);
    if (!conv) return;
    const last = conv.messages[conv.messages.length - 1];
    if (last && last.role === "assistant") {
      state.removeMessage(conv.id, last.id);
    }
    await runCompletion(conv.id);
  }, [runCompletion]);

  return { send, stop, regenerate, busy };
}
