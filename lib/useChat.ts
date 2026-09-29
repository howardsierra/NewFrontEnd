"use client";

import { useCallback, useRef, useState } from "react";
import { useStore, newMessage } from "./store";
import { attachmentToPrompt } from "./files";
import type { Attachment, ChatRequest, Conversation } from "./types";
import { PROVIDER_META } from "./providers";
import { resolvePrice, costFor } from "./pricing";
import { composePersona } from "./personas";
import { nanoid } from "nanoid";

/** Build the provider-agnostic message array with a resolved system prompt. */
function buildMessages(conv: Conversation, systemPrompt: string): ChatRequest["messages"] {
  const out: ChatRequest["messages"] = [];
  if (systemPrompt.trim()) {
    out.push({ role: "system", content: systemPrompt.trim() });
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

    // Compose the effective system prompt: active persona first, then the
    // conversation's own system prompt (extra per-chat instructions).
    const persona = conv.personaId
      ? state.personas.find((p) => p.id === conv.personaId)
      : undefined;
    const systemPrompt = [
      persona ? composePersona(persona) : "",
      conv.params.systemPrompt,
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n\n");
    const params =
      persona && typeof persona.temperature === "number"
        ? { ...conv.params, temperature: persona.temperature }
        : conv.params;

    const reqBody: ChatRequest = {
      kind: provider.kind,
      apiKey: provider.apiKey,
      baseUrl:
        provider.kind === "custom"
          ? provider.baseUrl
          : PROVIDER_META[provider.kind].baseUrl,
      headers: provider.headers,
      useResponsesApi: provider.useResponsesApi,
      model: conv.model,
      params,
      messages: buildMessages(conv, systemPrompt),
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
      let buffer = "";
      let streamError: string | null = null;

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let ev: any;
        try {
          ev = JSON.parse(trimmed);
        } catch {
          return;
        }
        if (ev.t === "d") {
          useStore.getState().appendToMessage(convId, assistant.id, ev.v);
        } else if (ev.t === "r") {
          useStore.getState().appendReasoning(convId, assistant.id, ev.v);
        } else if (ev.t === "u") {
          const usage = { input: ev.in, output: ev.out };
          const cachedModels = useStore.getState().modelCache[provider.id];
          const price = resolvePrice(conv.model, provider.kind, cachedModels);
          useStore.getState().patchMessage(convId, assistant.id, {
            usage,
            cost: price ? costFor(usage, price) : undefined,
          });
        } else if (ev.t === "e") {
          streamError = ev.v;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      }
      if (buffer) handleLine(buffer);

      const current = useStore
        .getState()
        .conversations.find((c) => c.id === convId)
        ?.messages.find((m) => m.id === assistant.id);
      const gotText = !!current?.content;
      useStore.getState().patchMessage(convId, assistant.id, {
        streaming: false,
        // Never leave a silent, empty bubble: explain why nothing came back.
        error: gotText
          ? current?.error
          : streamError ||
            current?.error ||
            "No reply came back from the model. Check the model name, or try another model.",
      });
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

  /** Generate an image from a prompt using the active provider. */
  const generateImage = useCallback(async (prompt: string, size: string) => {
    const state = useStore.getState();
    const conv = state.conversations.find((c) => c.id === state.activeId);
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

    state.addMessage(conv.id, newMessage("user", prompt));
    if (conv.messages.length === 0 && conv.title === "New chat") {
      state.renameConversation(conv.id, prompt.slice(0, 48).trim() || "Image");
    }
    const assistant = newMessage("assistant", "", {
      streaming: true,
      model: conv.model,
      providerLabel: provider.label,
    });
    state.addMessage(conv.id, assistant);

    setBusy(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: provider.kind,
          apiKey: provider.apiKey,
          baseUrl: provider.kind === "custom" ? provider.baseUrl : undefined,
          headers: provider.headers,
          model: conv.model,
          prompt,
          size,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.image) {
        useStore.getState().patchMessage(conv.id, assistant.id, {
          streaming: false,
          error: data.error || `Image request failed (${res.status}).`,
        });
        return;
      }
      const attachment: Attachment = {
        id: nanoid(),
        name: `${prompt.slice(0, 24).trim() || "image"}.png`,
        mime: "image/png",
        size: 0,
        kind: "image",
        dataUrl: data.image,
      };
      useStore.getState().patchMessage(conv.id, assistant.id, {
        streaming: false,
        content: "",
        attachments: [attachment],
      });
    } catch (e: any) {
      useStore.getState().patchMessage(conv.id, assistant.id, {
        streaming: false,
        error: e?.message || "Network error.",
      });
    } finally {
      setBusy(false);
    }
  }, []);

  return { send, stop, regenerate, generateImage, busy };
}
