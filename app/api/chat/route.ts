import { providerFailure } from "@/lib/request-errors";
import { NextRequest } from "next/server";
import type { ChatRequest } from "@/lib/types";
import { buildUpstreamCall, parseSse, StreamDiagnostics } from "@/lib/server/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Long generations (and slow "thinking" models) can take minutes.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let req: ChatRequest;
  try {
    req = (await request.json()) as ChatRequest;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!req || typeof req !== "object") return json({ error: "Invalid request body." }, 400);

  // Custom/local OpenAI-compatible servers may be keyless (LM Studio, Ollama).
  if (!req.apiKey && req.kind !== "custom") {
    return json({ error: "Missing API key." }, 400);
  }
  if (!req.model) return json({ error: "No model selected." }, 400);

  let call;
  try {
    call = buildUpstreamCall(req);
  } catch (e: any) {
    return json({ error: e.message || "Could not build request." }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(call.url, {
      method: "POST",
      headers: call.headers,
      body: call.body,
    });
  } catch (e: any) {
    return json(
      { error: "Could not reach the provider. Check the connection or choose another provider.", errorCode: "network" },
      502
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await safeErrorDetail(upstream);
    return json(
      providerFailure(upstream.status, detail, upstream.headers.get("retry-after")),
      upstream.status >= 400 ? upstream.status : 502
    );
  }

  const encoder = new TextEncoder();
  const flavor = call.flavor;
  const body = upstream.body;
  const contentType = upstream.headers.get("content-type") || "";

  // NDJSON stream: one JSON event per line. See StreamEvent in lib/types.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const diag: StreamDiagnostics = { raw: "" };
      let textChars = 0;
      let reasoningChars = 0;
      try {
        for await (const ev of parseSse(body, flavor, diag)) {
          if (ev.type === "text") {
            textChars += ev.text.length;
            emit({ t: "d", v: ev.text });
          } else if (ev.type === "reasoning") {
            reasoningChars += ev.text.length;
            emit({ t: "r", v: ev.text });
          } else {
            emit({ t: "u", in: ev.input, out: ev.output });
          }
        }
        if (textChars === 0) {
          emit({ t: "e", v: explainEmpty(reasoningChars > 0, diag.raw) });
          // Shows up in Vercel runtime logs so empty replies can be diagnosed.
          console.warn(
            `[chat] empty reply kind=${req.kind} model=${req.model} ` +
              `type=${contentType} reasoning=${reasoningChars} ` +
              `raw=${JSON.stringify(diag.raw.slice(0, 300))}`
          );
        }
      } catch (e: any) {
        emit({ t: "e", v: e.message || "stream interrupted" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function explainEmpty(hadReasoning: boolean, raw: string): string {
  if (hadReasoning) {
    return "The model spent its whole token budget thinking and never wrote an answer. Raise Max tokens in Params and try again.";
  }
  const finish = /"(?:finish_reason|finishReason|stop_reason)"\s*:\s*"([^"]+)"/.exec(raw)?.[1];
  if (finish && /safety|content_filter|recitation|blocked/i.test(finish)) {
    return `The provider blocked this reply (${finish}). Try rephrasing, or pick a different model.`;
  }
  if (finish && /length|max_tokens/i.test(finish)) {
    return "The reply was cut off before any text arrived. Raise Max tokens in Params.";
  }
  const snippet = raw.trim().slice(0, 160);
  return snippet
    ? `The model returned no text. The provider sent: ${snippet}`
    : "The model returned an empty response. Check that the selected model supports chat.";
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function safeErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      const detail = parsed.error?.message || parsed.error;
      return typeof detail === "string" ? detail : text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return res.statusText;
  }
}
