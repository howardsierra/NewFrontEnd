import type { ChatRequest } from "../types";
import { PROVIDER_META } from "../providers";

const ANTHROPIC_VERSION = "2023-06-01";

interface UpstreamCall {
  url: string;
  headers: Record<string, string>;
  body: string;
  /** How to decode the upstream SSE stream into plain text deltas. */
  flavor: "openai" | "anthropic";
}

function resolveBaseUrl(req: ChatRequest): string {
  if (req.kind === "custom") {
    const raw = (req.baseUrl || "").trim().replace(/\/+$/, "");
    if (!raw) throw new Error("Custom provider requires a base URL.");
    // Allow users to omit /v1; only append when there's clearly no version segment.
    return /\/v\d+$/.test(raw) ? raw : raw;
  }
  return PROVIDER_META[req.kind].baseUrl;
}

/** Build an OpenAI Chat Completions request (OpenAI, OpenRouter, custom). */
function buildOpenAiCall(req: ChatRequest): UpstreamCall {
  const base = resolveBaseUrl(req);
  const messages = req.messages.map((m) => {
    if (m.images && m.images.length > 0 && m.role === "user") {
      return {
        role: m.role,
        content: [
          ...(m.content ? [{ type: "text", text: m.content }] : []),
          ...m.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${req.apiKey}`,
  };
  if (req.kind === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/howardsierra/newfrontend";
    headers["X-Title"] = "NewFrontEnd";
  }

  return {
    url: `${base}/chat/completions`,
    headers,
    flavor: "openai",
    body: JSON.stringify({
      model: req.model,
      messages,
      stream: true,
      temperature: req.params.temperature,
      max_tokens: req.params.maxTokens,
      top_p: req.params.topP,
    }),
  };
}

/** Build an Anthropic Messages request. */
function buildAnthropicCall(req: ChatRequest): UpstreamCall {
  const base = PROVIDER_META.anthropic.baseUrl;
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const blocks: unknown[] = [];
      if (m.images && m.images.length > 0 && m.role === "user") {
        for (const url of m.images) {
          const match = /^data:(.+?);base64,(.*)$/.exec(url);
          if (match) {
            blocks.push({
              type: "image",
              source: { type: "base64", media_type: match[1], data: match[2] },
            });
          }
        }
      }
      if (m.content) blocks.push({ type: "text", text: m.content });
      return { role: m.role, content: blocks.length ? blocks : m.content };
    });

  return {
    url: `${base}/messages`,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    flavor: "anthropic",
    body: JSON.stringify({
      model: req.model,
      system: system || undefined,
      messages,
      stream: true,
      max_tokens: req.params.maxTokens,
      temperature: req.params.temperature,
      top_p: req.params.topP,
    }),
  };
}

export function buildUpstreamCall(req: ChatRequest): UpstreamCall {
  return req.kind === "anthropic"
    ? buildAnthropicCall(req)
    : buildOpenAiCall(req);
}

/**
 * Parse an upstream SSE stream and yield plain-text deltas.
 * Works for both OpenAI-style and Anthropic-style event streams.
 */
export async function* parseSse(
  stream: ReadableStream<Uint8Array>,
  flavor: "openai" | "anthropic"
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        let json: any;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }

        if (flavor === "openai") {
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === "string") yield delta;
        } else {
          // Anthropic: content_block_delta with text_delta.
          if (
            json.type === "content_block_delta" &&
            json.delta?.type === "text_delta" &&
            typeof json.delta.text === "string"
          ) {
            yield json.delta.text;
          }
          if (json.type === "error") {
            throw new Error(json.error?.message || "Anthropic stream error");
          }
        }
      }
    }
  }
}
