import { NextRequest } from "next/server";
import type { ChatRequest } from "@/lib/types";
import { buildUpstreamCall, parseSse } from "@/lib/server/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let req: ChatRequest;
  try {
    req = (await request.json()) as ChatRequest;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!req.apiKey) return json({ error: "Missing API key." }, 400);
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
      { error: `Could not reach provider: ${e.message || "network error"}` },
      502
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await safeErrorDetail(upstream);
    return json(
      { error: `Provider returned ${upstream.status}: ${detail}` },
      upstream.status === 401 ? 401 : 502
    );
  }

  const encoder = new TextEncoder();
  const flavor = call.flavor;
  const body = upstream.body;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of parseSse(body, flavor)) {
          controller.enqueue(encoder.encode(delta));
        }
      } catch (e: any) {
        // Surface mid-stream errors inline so the user sees them.
        controller.enqueue(
          encoder.encode(`\n\n[stream error] ${e.message || "interrupted"}`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
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
      return parsed.error?.message || parsed.error || text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return res.statusText;
  }
}
