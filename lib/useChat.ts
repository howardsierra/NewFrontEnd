"use client";

import { useCallback, useRef, useState } from "react";
import { useStore, newMessage } from "./store";
import { attachmentToPrompt } from "./files";
import type { Attachment, ChatMessage, ChatRequest, Conversation } from "./types";
import { PROVIDER_META } from "./providers";
import { resolvePrice, costFor } from "./pricing";
import { composePersona } from "./personas";
import { collectLibraryFiles } from "./file-library";
import { splitGeneratedFiles } from "./generated-files";
import { FILE_CREATION_INSTRUCTIONS } from "./generated-files";
import { nanoid } from "nanoid";

/** How many recent image-bearing messages keep their images in the request. */
const MAX_IMAGE_MESSAGES = 4;
/** Vercel rejects serverless request bodies over 4.5 MB. */
const MAX_REQUEST_BYTES = 4_300_000;

/** Build the provider-agnostic message array with a resolved system prompt. */
function buildMessages(conv: Conversation, systemPrompt: string): ChatRequest["messages"] {
  const out: ChatRequest["messages"] = [];
  if (systemPrompt.trim()) {
    out.push({ role: "system", content: systemPrompt.trim() });
  }
  // Every turn resends the whole history, so only the most recent images go
  // along; older ones are noted in text to keep requests small.
  const imageMsgIds = conv.messages
    .filter((m) => m.attachments?.some((a) => a.kind === "image" && a.dataUrl))
    .map((m) => m.id);
  const keepImagesFor = new Set(imageMsgIds.slice(-MAX_IMAGE_MESSAGES));

  for (const m of conv.messages) {
    if (m.role === "system" || m.error) continue;
    if (m.role === "assistant" && !m.content) continue; // skip empty placeholders
    let content = m.content;
    const images: string[] = [];
    if (m.attachments) {
      for (const a of m.attachments) {
        if (a.kind === "text") content += attachmentToPrompt(a);
        else if (a.kind === "image" && a.dataUrl) {
          if (keepImagesFor.has(m.id)) images.push(a.dataUrl);
          else content += `\n\n[An earlier image (${a.name}) was shared here.]`;
        }
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
    if (abortRef.current) return;
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
      FILE_CREATION_INSTRUCTIONS,
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

    const payload = JSON.stringify(reqBody);
    const payloadBytes = new TextEncoder().encode(payload).byteLength;
    if (payloadBytes > MAX_REQUEST_BYTES) {
      state.addMessage(
        convId,
        newMessage("assistant", "", {
          model: conv.model,
          providerLabel: provider.label,
          error: `This message is too large to send (${(payloadBytes / 1e6).toFixed(1)} MB; the limit is about 4.3 MB). Remove an attachment or start a new chat.`,
        })
      );
      return;
    }

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
        body: payload,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let msg = `Request failed (${res.status}).`;
        const failureDetails: Partial<ChatMessage> = {};
        try {
          const j = await res.json();
          if (typeof j.error === "string") msg = j.error;
          if (typeof j.errorCode === "string") failureDetails.errorCode = j.errorCode;
          if (typeof j.retryAfterSeconds === "number" && Number.isFinite(j.retryAfterSeconds) && j.retryAfterSeconds > 0) {
            failureDetails.retryAt = Date.now() + Math.min(j.retryAfterSeconds, 86400) * 1000;
          }
        } catch {}
        useStore.getState().patchMessage(convId, assistant.id, {
          streaming: false,
          error: msg,
          ...failureDetails,
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
      buffer += decoder.decode();
      if (buffer) handleLine(buffer);

      const current = useStore
        .getState()
        .conversations.find((c) => c.id === convId)
        ?.messages.find((m) => m.id === assistant.id);
      const gotText = !!current?.content;
      useStore.getState().patchMessage(convId, assistant.id, {
        streaming: false,
        // Never leave a silent, empty bubble: explain why nothing came back.
        error: streamError || (gotText
          ? current?.error
          : current?.error || "No reply came back from the model. Check the model name, or try another model."),
        errorCode: streamError ? "interrupted" : undefined,
      });
      const sourceId = conv.messages[conv.messages.length - 1]?.revisionOf;
      if (sourceId && current?.content && !streamError) {
        const latestState = useStore.getState();
        const source = collectLibraryFiles(latestState.conversations, latestState.libraryFiles).find((file) => file.id === sourceId);
        if (source) {
          const last = source.versions[source.versions.length - 1];
          const parts = splitGeneratedFiles(current.content);
          const candidates = parts.flatMap((part, index) => part.kind === "file" ? [{ part, index }] : []);
          const match = candidates.find(({ part }) => part.filename === last.filename || (part.path && part.path === last.path)) ?? (candidates.length === 1 ? candidates[0] : undefined);
          if (match) try {
            latestState.saveFileVersion(source, match.part.filename, match.part.content, match.part.path ?? (match.part.filename === last.filename ? last.path : undefined));
            latestState.patchMessage(convId, assistant.id, { fileRevision: { fileId: sourceId, partIndex: match.index } });
          } catch (cause) {
            latestState.patchMessage(convId, assistant.id, { fileNotice: cause instanceof Error ? cause.message : "The revised file could not be kept in the library. Download it from this reply." });
          }
        }
      }
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
          : "The connection was interrupted. Your prompt is saved; check your connection and retry.",
        errorCode: aborted ? undefined : "network",
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, []);

  const send = useCallback(
    async (text: string, attachments: Attachment[], revisionOf?: string) => {
      if (abortRef.current) return;
      const state = useStore.getState();
      const conv = state.conversations.find((c) => c.id === state.activeId);
      if (!conv) return;

      const userMsg = newMessage("user", text, {
        attachments: attachments.length ? attachments : undefined,
        revisionOf,
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
    if (abortRef.current) return;
    const state = useStore.getState();
    const conv = state.conversations.find((c) => c.id === state.activeId);
    if (!conv) return;
    const last = conv.messages[conv.messages.length - 1];
    if (last?.retryAt && last.retryAt > Date.now()) return;
    if (last && last.role === "assistant") {
      state.removeMessage(conv.id, last.id);
    }
    await runCompletion(conv.id);
  }, [runCompletion]);

  /** Generate an image from a prompt using the active provider. */
  const generateImage = useCallback(async (prompt: string, size: string, retry = false) => {
    if (abortRef.current) return;
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

    if (!retry) state.addMessage(conv.id, newMessage("user", prompt));
    if (conv.messages.length === 0 && conv.title === "New chat") {
      state.renameConversation(conv.id, prompt.slice(0, 48).trim() || "Image");
    }
    const assistant = newMessage("assistant", "", {
      streaming: true,
      model: conv.model,
      providerLabel: provider.label,
      imageRequest: { prompt, size },
    });
    state.addMessage(conv.id, assistant);

    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        signal: controller.signal,
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
          errorCode: data.errorCode,
          retryAt: Number.isFinite(data.retryAfterSeconds) && data.retryAfterSeconds > 0 ? Date.now() + Math.min(data.retryAfterSeconds, 86400) * 1000 : undefined,
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
        error: e?.name === "AbortError" ? "Stopped." : "The image request was interrupted. Check your connection and retry.",
        errorCode: e?.name === "AbortError" ? undefined : "network",
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, []);

  const retry = useCallback(async () => {
    if (abortRef.current) return;
    const state = useStore.getState();
    const conv = state.conversations.find((c) => c.id === state.activeId);
    const last = conv?.messages[conv.messages.length - 1];
    if (!conv || !last?.error || (last.retryAt && last.retryAt > Date.now())) return;
    if (last.imageRequest) {
      state.removeMessage(conv.id, last.id);
      await generateImage(last.imageRequest.prompt, last.imageRequest.size, true);
    } else {
      await regenerate();
    }
  }, [generateImage, regenerate]);

  const branchAndSend = useCallback(async (convId: string, messageId: string, text: string) => {
    if (abortRef.current) return;
    const id = useStore.getState().branchFromMessage(convId, messageId, text);
    await runCompletion(id);
  }, [runCompletion]);

  return { send, stop, regenerate, retry, branchAndSend, generateImage, busy };
}
