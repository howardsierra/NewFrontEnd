import { NextRequest } from "next/server";
import type { ModelInfo, ProviderKind } from "@/lib/types";
import { PROVIDER_META } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  kind: ProviderKind;
  apiKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const base =
    body.kind === "custom"
      ? (body.baseUrl || "").trim().replace(/\/+$/, "")
      : PROVIDER_META[body.kind].baseUrl;

  if (!base) return json({ error: "Missing base URL." }, 400);

  // Gemini lists models at GET /models?key=... and authenticates via query param.
  if (body.kind === "gemini") {
    try {
      const res = await fetch(`${base}/models?key=${encodeURIComponent(body.apiKey)}&pageSize=1000`);
      if (!res.ok) {
        const text = await res.text();
        return json({ error: `Provider returned ${res.status}: ${text.slice(0, 200)}` }, 502);
      }
      const data = await res.json();
      return json({ models: normalizeGemini(data) });
    } catch (e: any) {
      return json({ error: `Could not list models: ${e.message || "network error"}` }, 502);
    }
  }

  const headers: Record<string, string> =
    body.kind === "anthropic"
      ? { "x-api-key": body.apiKey, "anthropic-version": "2023-06-01" }
      : body.apiKey
        ? { Authorization: `Bearer ${body.apiKey}` }
        : {};
  // Merge user-supplied headers (e.g. Azure `api-key`).
  if (body.headers) Object.assign(headers, body.headers);

  try {
    const res = await fetch(`${base}/models`, { headers });
    if (!res.ok) {
      const text = await res.text();
      return json({ error: `Provider returned ${res.status}: ${text.slice(0, 200)}` }, 502);
    }
    const data = await res.json();
    const models = normalizeModels(data);
    return json({ models });
  } catch (e: any) {
    return json({ error: `Could not list models: ${e.message || "network error"}` }, 502);
  }
}

function normalizeModels(data: any): ModelInfo[] {
  // OpenAI / OpenRouter / Anthropic all return { data: [...] }.
  const list: any[] = Array.isArray(data) ? data : data?.data ?? [];
  const models = list
    .map((m): ModelInfo | null => {
      const id = m.id ?? m.name;
      if (!id) return null;
      // OpenRouter reports pricing in USD *per token* as strings; normalize to
      // USD per 1M tokens. Other providers don't return pricing here.
      let pricing: ModelInfo["pricing"];
      const p = m.pricing;
      if (p && (p.prompt != null || p.completion != null)) {
        const inPer = parseFloat(p.prompt ?? "0") * 1e6;
        const outPer = parseFloat(p.completion ?? "0") * 1e6;
        if (Number.isFinite(inPer) && Number.isFinite(outPer) && (inPer > 0 || outPer > 0)) {
          pricing = { input: inPer, output: outPer };
        }
      }
      return {
        id,
        label: m.name && m.name !== id ? m.name : undefined,
        contextLength: m.context_length ?? m.context_window ?? m.top_provider?.context_length,
        pricing,
      };
    })
    .filter((m): m is ModelInfo => m !== null);

  models.sort((a, b) => a.id.localeCompare(b.id));
  return models;
}

/** Gemini: { models: [{ name: "models/gemini-2.5-pro", supportedGenerationMethods, inputTokenLimit }] } */
function normalizeGemini(data: any): ModelInfo[] {
  const list: any[] = data?.models ?? [];
  return list
    .filter((m) =>
      Array.isArray(m.supportedGenerationMethods)
        ? m.supportedGenerationMethods.some((x: string) => x.includes("generateContent"))
        : true
    )
    .map((m): ModelInfo => ({
      id: String(m.name || "").replace(/^models\//, ""),
      label: m.displayName || undefined,
      contextLength: m.inputTokenLimit,
    }))
    .filter((m) => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
