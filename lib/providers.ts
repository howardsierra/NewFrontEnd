import type { ProviderKind } from "./types";

interface ProviderMeta {
  kind: ProviderKind;
  label: string;
  /** Default API base URL (OpenAI-compatible "/v1" style unless noted). */
  baseUrl: string;
  /** Whether the base URL is user-editable in the UI. */
  editableBaseUrl: boolean;
  /** Where to get an API key. */
  keysUrl?: string;
  hint: string;
  accent: string;
}

export const PROVIDER_META: Record<ProviderKind, ProviderMeta> = {
  openrouter: {
    kind: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    editableBaseUrl: false,
    keysUrl: "https://openrouter.ai/keys",
    hint: "One key, hundreds of models. Great default.",
    accent: "#6e8bff",
  },
  anthropic: {
    kind: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    editableBaseUrl: false,
    keysUrl: "https://console.anthropic.com/settings/keys",
    hint: "Claude models via the native Messages API.",
    accent: "#d97757",
  },
  openai: {
    kind: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    editableBaseUrl: false,
    keysUrl: "https://platform.openai.com/api-keys",
    hint: "GPT models via the official API.",
    accent: "#10a37f",
  },
  custom: {
    kind: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    editableBaseUrl: true,
    hint: "Any OpenAI-compatible endpoint: LM Studio, Ollama, vLLM, Together, Groq, etc.",
    accent: "#9aa3b8",
  },
};

/** Default model suggestions when a provider can't list models. */
export const FALLBACK_MODELS: Record<ProviderKind, string[]> = {
  openrouter: [
    "anthropic/claude-sonnet-4.5",
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "meta-llama/llama-3.3-70b-instruct",
  ],
  anthropic: [
    "claude-opus-4-20250514",
    "claude-sonnet-4-5-20250929",
    "claude-3-5-haiku-20241022",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
  custom: [],
};
