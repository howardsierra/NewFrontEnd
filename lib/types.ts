// Shared types used across the app.

export type ProviderKind = "openrouter" | "anthropic" | "openai" | "custom";

/** A configured provider connection (stored in the browser). */
export interface ProviderConfig {
  id: string;
  /** Which protocol/transport to use. "custom" means an OpenAI-compatible endpoint. */
  kind: ProviderKind;
  /** Human label shown in the UI, e.g. "OpenAI", "My LM Studio". */
  label: string;
  apiKey: string;
  /** Base URL. Only required/editable for custom providers. */
  baseUrl?: string;
  /** Optional default model id for this provider. */
  defaultModel?: string;
  enabled: boolean;
}

export interface ModelInfo {
  id: string;
  label?: string;
  /** Context window in tokens, when known. */
  contextLength?: number;
  /** Price in USD per 1M tokens, when known (e.g. from OpenRouter). */
  pricing?: { input: number; output: number };
}

/** A piece of content attached to a user message. */
export interface Attachment {
  id: string;
  name: string;
  /** MIME type as reported by the browser. */
  mime: string;
  size: number;
  /** "text" => extracted text inlined into the prompt. "image" => sent as vision input. */
  kind: "text" | "image";
  /** Extracted text (for text/pdf/code/json). */
  text?: string;
  /** data: URL (for images). */
  dataUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  /** Wall-clock timestamp (ms). */
  createdAt: number;
  /** Bookkeeping shown in the UI. */
  model?: string;
  providerLabel?: string;
  /** True while the assistant message is still streaming. */
  streaming?: boolean;
  error?: string;
  /** Real token usage reported by the provider, when available. */
  usage?: TokenUsage;
  /** Estimated cost in USD for this message, when pricing is known. */
  cost?: number;
}

export interface TokenUsage {
  input: number;
  output: number;
}

/** Events streamed from /api/chat to the client (NDJSON, one per line). */
export type StreamEvent =
  | { t: "d"; v: string } // text delta
  | { t: "u"; in: number; out: number } // usage
  | { t: "e"; v: string }; // error

export interface GenerationParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  providerId: string | null;
  model: string | null;
  params: GenerationParams;
  createdAt: number;
  updatedAt: number;
}

/** Request body sent from the client to /api/chat. */
export interface ChatRequest {
  kind: ProviderKind;
  apiKey: string;
  baseUrl?: string;
  model: string;
  params: GenerationParams;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
    images?: string[]; // data URLs
  }>;
}

export const DEFAULT_PARAMS: GenerationParams = {
  temperature: 0.8,
  maxTokens: 4096,
  topP: 1,
  systemPrompt: "",
};
