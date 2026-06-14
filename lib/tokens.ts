import type { ChatMessage, Conversation } from "./types";

/**
 * Rough token estimate. Not a real tokenizer — uses a blended heuristic that
 * lands within ~10-15% for typical English + code. Used for live context size
 * previews and as a fallback when a provider doesn't report usage.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // ~4 chars/token on average, but also bound by word count.
  const byChars = text.length / 4;
  const byWords = text.trim().split(/\s+/).length * 1.33;
  return Math.ceil((byChars + byWords) / 2);
}

/** Estimate the token footprint of a single message (content + text attachments). */
export function estimateMessageTokens(m: ChatMessage): number {
  let t = estimateTokens(m.content);
  if (m.attachments) {
    for (const a of m.attachments) {
      if (a.kind === "text" && a.text) t += estimateTokens(a.text);
      else if (a.kind === "image") t += 800; // rough per-image vision cost
    }
  }
  return t;
}

/** Estimated tokens for the full context that would be sent next. */
export function estimateContextTokens(conv: Conversation): number {
  let t = estimateTokens(conv.params.systemPrompt);
  for (const m of conv.messages) {
    if (m.error) continue;
    t += estimateMessageTokens(m);
  }
  return t;
}

/** Sum of real usage reported across a conversation's assistant messages. */
export function conversationUsage(conv: Conversation): {
  input: number;
  output: number;
  hasReal: boolean;
} {
  let input = 0;
  let output = 0;
  let hasReal = false;
  for (const m of conv.messages) {
    if (m.usage) {
      input += m.usage.input;
      output += m.usage.output;
      hasReal = true;
    }
  }
  return { input, output, hasReal };
}

export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
