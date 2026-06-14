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

/**
 * One-click presets for popular OpenAI-compatible services. Picking one creates
 * a "custom" provider with the base URL (and a sensible default model) prefilled
 * so you only need to paste your API key.
 */
export interface CustomPreset {
  id: string;
  label: string;
  baseUrl: string;
  keysUrl?: string;
  defaultModel?: string;
  hint?: string;
}

export const CUSTOM_PRESETS: CustomPreset[] = [
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keysUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    keysUrl: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-chat",
  },
  {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keysUrl: "https://console.mistral.ai/api-keys/",
    defaultModel: "mistral-large-latest",
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    keysUrl: "https://console.x.ai/",
    defaultModel: "grok-2-latest",
  },
  {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    keysUrl: "https://api.together.xyz/settings/api-keys",
  },
  {
    id: "fireworks",
    label: "Fireworks",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    keysUrl: "https://fireworks.ai/account/api-keys",
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    keysUrl: "https://deepinfra.com/dash/api_keys",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    keysUrl: "https://www.perplexity.ai/settings/api",
    defaultModel: "sonar",
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    baseUrl: "http://localhost:1234/v1",
    hint: "Start LM Studio's local server first. No API key needed.",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    hint: "Run `ollama serve`. No API key needed.",
  },
  {
    id: "blank",
    label: "Other / fully custom",
    baseUrl: "",
    hint: "Any OpenAI-compatible endpoint. Enter the base URL ending in /v1.",
  },
];

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
