import type { ModelInfo, ProviderKind } from "./types";

export type VisionSupport = "yes" | "no" | "unknown";

// Families known to be text-only. Deliberately conservative: when in doubt we
// say "unknown" and don't warn.
const TEXT_ONLY =
  /(deepseek|o1-mini|o3-mini|gpt-3\.5|gpt-oss|mixtral|codestral|command-r|(^|\/)phi-|wizardlm|nous-hermes|llama-3(\.[0-3])?-(?!.*vision)|qwen(?!.*vl)[\w.-]*coder|mistral-(small|medium|large|nemo)(?!.*pixtral))/i;

// Families known to accept images.
const VISION =
  /(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|(^|\/)o1(?!-mini)|(^|\/)o3(?!-mini)|(^|\/)o4|claude-3|claude-(opus|sonnet|haiku)|gemini|gemma-3|pixtral|llava|vision|[-_.]vl\b|qwen.*vl|llama-4|grok-(2-vision|4)|nova-(lite|pro))/i;

/**
 * Whether the selected model can see images. OpenRouter reports this exactly
 * (via the cached model list); otherwise fall back to name heuristics.
 */
export function visionSupport(
  _kind: ProviderKind,
  model: string | null | undefined,
  cachedModels?: ModelInfo[]
): VisionSupport {
  if (!model) return "unknown";
  const info = cachedModels?.find((m) => m.id === model);
  if (info && typeof info.vision === "boolean") return info.vision ? "yes" : "no";
  if (VISION.test(model)) return "yes";
  if (TEXT_ONLY.test(model)) return "no";
  return "unknown";
}
