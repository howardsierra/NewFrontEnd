import { NextRequest } from "next/server";
import { buildImageCall, imageFromResponse, ImageRequest } from "@/lib/server/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let req: ImageRequest;
  try {
    req = (await request.json()) as ImageRequest;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!req.prompt?.trim()) return json({ error: "Enter a prompt." }, 400);
  if (!req.model) return json({ error: "No model selected." }, 400);
  if (!req.apiKey && req.kind !== "custom") return json({ error: "Missing API key." }, 400);

  let call;
  try {
    call = buildImageCall(req);
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
    return json({ error: `Could not reach provider: ${e.message || "network error"}` }, 502);
  }

  const text = await upstream.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return json({ error: `Provider returned a non-JSON response (${upstream.status}).` }, 502);
  }

  if (!upstream.ok) {
    const detail = data?.error?.message || data?.message || text.slice(0, 300);
    return json({ error: `Provider returned ${upstream.status}: ${detail}` }, upstream.status);
  }

  const image = imageFromResponse(req.kind, data);
  if (!image) {
    return json(
      { error: "No image returned. Make sure the selected model supports image generation." },
      502
    );
  }
  return json({ image });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
