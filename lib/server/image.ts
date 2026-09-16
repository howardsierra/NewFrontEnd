import type { ProviderKind } from "../types";
import { PROVIDER_META } from "../providers";

export interface ImageRequest {
  kind: ProviderKind;
  apiKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  model: string;
  prompt: string;
  size?: string;
}

interface ImageCall {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function base(req: ImageRequest): string {
  if (req.kind === "custom") return (req.baseUrl || "").trim().replace(/\/+$/, "");
  return PROVIDER_META[req.kind].baseUrl;
}

export function buildImageCall(req: ImageRequest): ImageCall {
  if (req.kind === "anthropic") {
    throw new Error("Anthropic does not support image generation.");
  }

  if (req.kind === "gemini") {
    const model = encodeURIComponent(req.model);
    const key = encodeURIComponent(req.apiKey);
    return {
      url: `${base(req)}/models/${model}:generateContent?key=${key}`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: req.prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (req.apiKey) headers["Authorization"] = `Bearer ${req.apiKey}`;
  if (req.headers) Object.assign(headers, req.headers);

  if (req.kind === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/howardsierra/newfrontend";
    headers["X-Title"] = "NewFrontEnd";
    return {
      url: `${base(req)}/chat/completions`,
      headers,
      body: JSON.stringify({
        model: req.model,
        messages: [{ role: "user", content: req.prompt }],
        modalities: ["image", "text"],
      }),
    };
  }

  // OpenAI + OpenAI-compatible custom endpoints
  return {
    url: `${base(req)}/images/generations`,
    headers,
    body: JSON.stringify({
      model: req.model,
      prompt: req.prompt,
      size: req.size || "1024x1024",
      n: 1,
    }),
  };
}

/** Extract an image (data URL or remote URL) from a provider response. */
export function imageFromResponse(kind: ProviderKind, data: any): string {
  if (kind === "gemini") {
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const part = parts.find((p: any) => p.inlineData || p.inline_data);
    const img = part?.inlineData || part?.inline_data;
    return img?.data
      ? `data:${img.mimeType || img.mime_type || "image/png"};base64,${img.data}`
      : "";
  }
  if (kind === "openrouter") {
    const img = data?.choices?.[0]?.message?.images?.[0];
    return img?.image_url?.url || img?.url || "";
  }
  const first = data?.data?.[0];
  return first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : "");
}
