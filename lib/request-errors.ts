export type RequestErrorCode =
  | "authentication" | "rate_limit" | "quota" | "model" | "context"
  | "invalid_request" | "provider" | "network" | "interrupted";

export interface RequestFailure {
  error: string;
  errorCode: RequestErrorCode;
  retryAfterSeconds?: number;
}

/** Keep provider response bodies (which may contain credentials) out of the UI. */
export function providerFailure(status: number, detail = "", retryAfter?: string | null): RequestFailure {
  if (status === 401 || status === 403) return {
    errorCode: "authentication", error: "The provider rejected this connection. Check your API key and account permissions in Providers & keys.",
  };
  if (status === 402 || (status === 429 && /quota|credit|billing|balance|insufficient/i.test(detail))) return {
    errorCode: "quota", error: "Your provider account has reached its usage or credit limit. Check your billing or choose another provider.",
  };
  if (status === 429) {
    const seconds = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) : (Date.parse(retryAfter) - Date.now()) / 1000) : NaN;
    return { errorCode: "rate_limit", error: "The provider is receiving too many requests. Wait a moment, then retry.",
      ...(Number.isFinite(seconds) && seconds > 0 ? { retryAfterSeconds: Math.ceil(Math.min(seconds, 86400)) } : {}) };
  }
  if (status === 404 || /model.*(?:not found|does not exist|unavailable|not supported)/i.test(detail)) return {
    errorCode: "model", error: "This model is unavailable or your account cannot access it. Choose another model in the top bar.",
  };
  if (status === 413 || /context.{0,30}(?:length|limit)|too many tokens|maximum context/i.test(detail)) return {
    errorCode: "context", error: "This chat exceeds the provider's context or request limit. Shorten the prompt, remove attachments, or start a new chat.",
  };
  if (status >= 500) return { errorCode: "provider", error: "The provider is temporarily unavailable. Retry shortly or choose another provider." };
  return { errorCode: "invalid_request", error: "The provider could not accept this request. Check the model and generation parameters, then retry." };
}
