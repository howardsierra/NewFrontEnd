import type { Conversation, ModelInfo, ProviderKind, TokenUsage } from "./types";

/** A price in USD per 1,000,000 tokens. */
export interface Price {
  input: number;
  output: number;
}

/**
 * Curated fallback price table for OpenAI and Anthropic (USD per 1M tokens).
 * OpenRouter prices come live from its /models endpoint and take precedence;
 * custom/local endpoints are treated as free unless they report pricing.
 *
 * These are manually maintained and may drift — they're a best-effort estimate,
 * not a billing source of truth. Patterns are matched as substrings against the
 * model id (provider prefixes like "anthropic/" are stripped first), most
 * specific first.
 */
const STATIC_PRICES: Array<{ match: RegExp; price: Price }> = [
  // ---- Anthropic Claude ----
  // Note: model ids embed dates (lots of digits), so version matches use
  // explicit separators (e.g. "haiku-4") rather than ".*4" to avoid false hits.
  { match: /claude.*opus/, price: { input: 15, output: 75 } },
  { match: /claude.*sonnet/, price: { input: 3, output: 15 } },
  { match: /3[-.]5[-.]haiku|haiku.*3[-.]5/, price: { input: 0.8, output: 4 } },
  { match: /3[-.]haiku/, price: { input: 0.25, output: 1.25 } },
  { match: /haiku[-.]?4|haiku.*4[-.]5|4[-.]5[-.]haiku/, price: { input: 1, output: 5 } },
  { match: /haiku/, price: { input: 0.8, output: 4 } },

  // ---- OpenAI ----
  { match: /gpt-4o-mini/, price: { input: 0.15, output: 0.6 } },
  { match: /gpt-4o/, price: { input: 2.5, output: 10 } },
  { match: /gpt-4\.1-nano/, price: { input: 0.1, output: 0.4 } },
  { match: /gpt-4\.1-mini/, price: { input: 0.4, output: 1.6 } },
  { match: /gpt-4\.1/, price: { input: 2, output: 8 } },
  { match: /gpt-4-turbo/, price: { input: 10, output: 30 } },
  { match: /gpt-4/, price: { input: 30, output: 60 } },
  { match: /gpt-3\.5/, price: { input: 0.5, output: 1.5 } },
  { match: /o1-mini|o3-mini|o4-mini/, price: { input: 1.1, output: 4.4 } },
  { match: /o1-pro/, price: { input: 150, output: 600 } },
  { match: /o1/, price: { input: 15, output: 60 } },
  { match: /o3/, price: { input: 2, output: 8 } },
];

/** Strip a provider prefix (e.g. "anthropic/claude-...") and lowercase. */
function normalizeId(id: string): string {
  const lower = id.toLowerCase();
  const slash = lower.lastIndexOf("/");
  return slash >= 0 ? lower.slice(slash + 1) : lower;
}

function staticPrice(modelId: string): Price | null {
  const norm = normalizeId(modelId);
  for (const { match, price } of STATIC_PRICES) {
    if (match.test(norm)) return price;
  }
  return null;
}

/**
 * Resolve a price for a model. Prefers live pricing from the provider's cached
 * model list (OpenRouter), then falls back to the curated static table.
 */
export function resolvePrice(
  modelId: string | null,
  _kind: ProviderKind,
  cachedModels?: ModelInfo[]
): Price | null {
  if (!modelId) return null;
  const cached = cachedModels?.find((m) => m.id === modelId);
  if (cached?.pricing) return cached.pricing;
  return staticPrice(modelId);
}

/** Cost in USD for a usage record at the given price (per 1M tokens). */
export function costFor(usage: TokenUsage, price: Price): number {
  return (usage.input * price.input + usage.output * price.output) / 1e6;
}

/** Sum of per-message costs recorded across a conversation. */
export function conversationCost(conv: Conversation): {
  total: number;
  hasCost: boolean;
} {
  let total = 0;
  let hasCost = false;
  for (const m of conv.messages) {
    if (typeof m.cost === "number") {
      total += m.cost;
      hasCost = true;
    }
  }
  return { total, hasCost };
}

export function formatCost(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
