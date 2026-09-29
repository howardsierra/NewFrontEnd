import type { ChatRequest } from "../types";
import { PROVIDER_META } from "../providers";

const ANTHROPIC_VERSION = "2023-06-01";

interface UpstreamCall {
  url: string;
  headers: Record<string, string>;
  body: string;
  /** How to decode the upstream SSE stream into plain text deltas. */
  flavor: "openai" | "anthropic" | "gemini";
}

/** OpenAI reasoning models (o1/o3/o4, GPT-5) reject temperature/top_p. */
function isOpenAiReasoningModel(model: string): boolean {
  return /(^|\/)(o\d|gpt-5)/i.test(model);
}

function resolveBaseUrl(req: ChatRequest): string {
  if (req.kind === "custom") {
    const raw = (req.baseUrl || "").trim().replace(/\/+$/, "");
    if (!raw) throw new Error("Custom provider requires a base URL.");
    return raw;
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
  };
  // A key is optional for local servers (LM Studio / Ollama).
  if (req.apiKey) headers["Authorization"] = `Bearer ${req.apiKey}`;
  if (req.kind === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/howardsierra/newfrontend";
    headers["X-Title"] = "Flux.AI";
  }
  // User-supplied headers win (e.g. Azure's `api-key`).
  if (req.headers) Object.assign(headers, req.headers);

  // OpenAI Responses API (/responses) — different payload + endpoint.
  if (req.useResponsesApi) {
    const input = req.messages.map((m) => {
      if (m.images && m.images.length > 0 && m.role === "user") {
        return {
          role: m.role,
          content: [
            ...(m.content ? [{ type: "input_text", text: m.content }] : []),
            ...m.images.map((url) => ({ type: "input_image", image_url: url })),
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
    return {
      url: `${base}/responses`,
      headers,
      flavor: "openai",
      body: JSON.stringify({
        model: req.model,
        input,
        stream: true,
        max_output_tokens: req.params.maxTokens,
        ...(isOpenAiReasoningModel(req.model)
          ? {}
          : { temperature: req.params.temperature, top_p: req.params.topP }),
      }),
    };
  }

  const body: Record<string, unknown> = {
    model: req.model,
    messages,
    stream: true,
  };
  if (req.kind === "openai") {
    // OpenAI deprecated max_tokens; o-series / GPT-5 reject it and any
    // non-default temperature/top_p.
    body.max_completion_tokens = req.params.maxTokens;
    if (!isOpenAiReasoningModel(req.model)) {
      body.temperature = req.params.temperature;
      body.top_p = req.params.topP;
    }
  } else {
    body.max_tokens = req.params.maxTokens;
    body.temperature = req.params.temperature;
    body.top_p = req.params.topP;
  }
  // Ask for usage in the final stream chunk. Custom/local servers may not
  // support this option, so only request it for providers known to honor it.
  if (req.kind === "openai" || req.kind === "openrouter") {
    body.stream_options = { include_usage: true };
  }

  return {
    url: `${base}/chat/completions`,
    headers,
    flavor: "openai",
    body: JSON.stringify(body),
  };
}

/** Build a Google Gemini streamGenerateContent request. */
function buildGeminiCall(req: ChatRequest): UpstreamCall {
  const base = PROVIDER_META.gemini.baseUrl;
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const parts: unknown[] = [];
      if (m.images && m.images.length > 0 && m.role === "user") {
        for (const url of m.images) {
          const match = /^data:(.+?);base64,(.*)$/.exec(url);
          if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
      if (m.content) parts.push({ text: m.content });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: req.params.temperature,
      topP: req.params.topP,
      maxOutputTokens: req.params.maxTokens,
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const model = encodeURIComponent(req.model);
  const key = encodeURIComponent(req.apiKey);
  return {
    url: `${base}/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
    headers: { "Content-Type": "application/json" },
    flavor: "gemini",
    body: JSON.stringify(body),
  };
}

export function buildUpstreamCall(req: ChatRequest): UpstreamCall {
  if (req.kind === "anthropic") return buildAnthropicCall(req);
  if (req.kind === "gemini") return buildGeminiCall(req);
  return buildOpenAiCall(req);
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
      // Newer Claude models reject temperature and top_p together; only send
      // top_p when the user actually lowered it.
      ...(req.params.topP < 1
        ? { top_p: req.params.topP }
        : { temperature: Math.min(req.params.temperature, 1) }),
    }),
  };
}

export type ParsedEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "usage"; input: number; output: number };

/** Filled in by parseSse so callers can explain an empty reply. */
export interface StreamDiagnostics {
  /** First ~64KB of what the provider actually sent. */
  raw: string;
}

type Flavor = "openai" | "anthropic" | "gemini";

function contentToText(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("");
  }
  return "";
}

function errorMessage(json: any): string | null {
  const e = json?.error;
  if (!e) return null;
  if (typeof e === "string") return e;
  return e.message || e.msg || JSON.stringify(e).slice(0, 300);
}

/** OpenAI Chat Completions / Responses API (also OpenRouter + compatible servers). */
function* fromOpenAi(json: any): Generator<ParsedEvent> {
  const err = errorMessage(json);
  if (err) throw new Error(err);

  const choice = json.choices?.[0];
  if (choice) {
    if (choice.delta) {
      const d = choice.delta;
      // Reasoning models: OpenRouter uses `reasoning`, DeepSeek & others `reasoning_content`.
      const r = d.reasoning ?? d.reasoning_content;
      if (typeof r === "string" && r) yield { type: "reasoning", text: r };
      const t = contentToText(d.content);
      if (t) yield { type: "text", text: t };
    } else if (choice.message) {
      // Server ignored stream:true and sent a whole message.
      const m = choice.message;
      const r = m.reasoning ?? m.reasoning_content;
      if (typeof r === "string" && r) yield { type: "reasoning", text: r };
      const t = contentToText(m.content);
      if (t) yield { type: "text", text: t };
    } else if (typeof choice.text === "string" && choice.text) {
      yield { type: "text", text: choice.text };
    }
  }

  // Responses API events
  if (typeof json.type === "string") {
    if (json.type === "response.output_text.delta" && typeof json.delta === "string") {
      yield { type: "text", text: json.delta };
    } else if (
      (json.type === "response.reasoning_summary_text.delta" ||
        json.type === "response.reasoning_text.delta") &&
      typeof json.delta === "string"
    ) {
      yield { type: "reasoning", text: json.delta };
    } else if (json.type === "response.completed" && json.response?.usage) {
      yield {
        type: "usage",
        input: json.response.usage.input_tokens ?? 0,
        output: json.response.usage.output_tokens ?? 0,
      };
    } else if (json.type === "response.failed" || json.type === "error") {
      throw new Error(
        json.response?.error?.message || json.message || "The provider reported a failure."
      );
    }
  } else if (typeof json.output_text === "string" && json.output_text) {
    // Non-streamed Responses API body.
    yield { type: "text", text: json.output_text };
  }

  // Chat Completions usage (final chunk, or a non-streamed body)
  if (json.usage && typeof json.usage.prompt_tokens === "number") {
    yield {
      type: "usage",
      input: json.usage.prompt_tokens ?? 0,
      output: json.usage.completion_tokens ?? 0,
    };
  }
}

function* fromAnthropic(json: any, st: { input: number; output: number }): Generator<ParsedEvent> {
  if (json.type === "error" || (json.error && !json.type)) {
    throw new Error(errorMessage(json) || "Anthropic stream error");
  }
  if (json.type === "message_start" && json.message?.usage) {
    st.input = json.message.usage.input_tokens ?? 0;
    st.output = json.message.usage.output_tokens ?? 0;
  }
  if (json.type === "content_block_delta" && json.delta) {
    if (json.delta.type === "text_delta" && typeof json.delta.text === "string") {
      yield { type: "text", text: json.delta.text };
    } else if (json.delta.type === "thinking_delta" && typeof json.delta.thinking === "string") {
      yield { type: "reasoning", text: json.delta.thinking };
    }
  }
  if (json.type === "message_delta" && json.usage) {
    st.output = json.usage.output_tokens ?? st.output;
    yield { type: "usage", input: st.input, output: st.output };
  }
  // Non-streamed Messages body
  if (json.type === "message" && Array.isArray(json.content)) {
    for (const b of json.content) {
      if (b.type === "text" && b.text) yield { type: "text", text: b.text };
      if (b.type === "thinking" && b.thinking) yield { type: "reasoning", text: b.thinking };
    }
    if (json.usage) {
      yield { type: "usage", input: json.usage.input_tokens ?? 0, output: json.usage.output_tokens ?? 0 };
    }
  }
}

function* fromGemini(json: any): Generator<ParsedEvent> {
  // Without alt=sse Gemini returns a JSON array of chunks.
  if (Array.isArray(json)) {
    for (const item of json) yield* fromGemini(item);
    return;
  }
  const err = errorMessage(json);
  if (err) throw new Error(err);
  const block = json.promptFeedback?.blockReason;
  if (block) throw new Error(`Gemini blocked this prompt (${block}).`);

  const parts = json.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (typeof p.text !== "string" || !p.text) continue;
      yield p.thought ? { type: "reasoning", text: p.text } : { type: "text", text: p.text };
    }
  }
  if (json.usageMetadata) {
    yield {
      type: "usage",
      input: json.usageMetadata.promptTokenCount ?? 0,
      output: json.usageMetadata.candidatesTokenCount ?? 0,
    };
  }
}

/**
 * Parse a provider's streaming response into typed events.
 *
 * Line-based and tolerant: handles CRLF line endings (Gemini), a final event
 * with no trailing blank line, errors delivered inside a 200 stream, reasoning
 * deltas, and servers that ignore `stream: true` and return one JSON body.
 */
export async function* parseSse(
  stream: ReadableStream<Uint8Array>,
  flavor: Flavor,
  diag?: StreamDiagnostics
): AsyncGenerator<ParsedEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const anthropicState = { input: 0, output: 0 };
  let buffer = "";
  let raw = "";
  let sawData = false;

  const extract = (json: any): Generator<ParsedEvent> =>
    flavor === "anthropic"
      ? fromAnthropic(json, anthropicState)
      : flavor === "gemini"
        ? fromGemini(json)
        : fromOpenAi(json);

  function* processLine(line: string): Generator<ParsedEvent> {
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (!line.startsWith("data:")) return; // event:, id:, ": comments", blanks
    sawData = true;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    yield* extract(json);
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (raw.length < 65536) raw += chunk;
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      yield* processLine(line);
    }
  }
  buffer += decoder.decode();
  if (buffer) yield* processLine(buffer);
  if (diag) diag.raw = raw;

  // Not an event stream at all — the provider sent one plain JSON body.
  if (!sawData) {
    const body = raw.trim();
    if (!body) return;
    let json: any;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`Unrecognized response from the provider: ${body.slice(0, 200)}`);
    }
    yield* extract(json);
  }
}
