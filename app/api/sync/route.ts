import { NextRequest, NextResponse } from "next/server";
import {
  BlobPreconditionFailedError,
  del,
  get,
  list,
  put,
} from "@vercel/blob";

// Encrypted sync storage. Everything here is ciphertext produced in the
// browser; this route only moves bytes in and out of a private Blob store.
//
//   GET    /api/sync?status=1                 -> { configured }
//   GET    /api/sync?vault=<id>&key=<key>     -> bytes (404 if missing), ETag header
//   PUT    /api/sync?vault=<id>&key=<key>     -> { etag }  (If-Match honored; 412 on conflict)
//   DELETE /api/sync?vault=<id>&key=<key|all> -> { ok }    (conv/<id> also removes its images)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4_000_000;
const VAULT = /^[a-f0-9]{64}$/;
const KEY = /^(meta|conv\/[\w-]{1,64}|img\/[\w-]{1,64}\/[\w-]{1,64})$/;

/**
 * Find Blob credentials. Stores connect either with a read-write token or
 * (newer) a store id plus Vercel's OIDC identity, and the variable names can
 * carry a custom prefix chosen when connecting the store.
 */
function blobAuth(): { token?: string; storeId?: string } | null {
  const env = process.env;
  if (env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID) return {};
  for (const [name, value] of Object.entries(env)) {
    if (!value) continue;
    if (name.endsWith("_READ_WRITE_TOKEN") && value.startsWith("vercel_blob_rw_")) {
      return { token: value };
    }
  }
  for (const [name, value] of Object.entries(env)) {
    if (value && name.endsWith("_STORE_ID") && value.startsWith("store_")) {
      return { storeId: value };
    }
  }
  return null;
}

const configured = () => blobAuth() !== null;

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Sync storage isn't set up on this deployment yet. Create a private Vercel Blob store and connect it to this project.",
    },
    { status: 503 }
  );
}

function parse(req: NextRequest, allowAll = false) {
  const vault = req.nextUrl.searchParams.get("vault") ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!VAULT.test(vault) || !(KEY.test(key) || (allowAll && key === "all"))) return null;
  return { vault, key, path: `vaults/${vault}/${key}.bin` };
}

function fail(e: unknown) {
  const message = e instanceof Error ? e.message : "Storage error.";
  console.warn("[sync]", message);
  return NextResponse.json({ error: `Sync storage error: ${message}` }, { status: 502 });
}

async function deletePrefix(prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000, ...blobAuth() });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url), { ...blobAuth() });
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("status")) {
    // Names only (never values), to help diagnose a store that isn't picked up.
    const seen = Object.keys(process.env).filter((k) => /BLOB|STORE_ID/.test(k)).sort();
    return NextResponse.json({ configured: configured(), env: seen });
  }
  if (!configured()) return notConfigured();
  const p = parse(req);
  if (!p) return NextResponse.json({ error: "Bad vault or key." }, { status: 400 });

  try {
    const res = await get(p.path, { access: "private", useCache: false, ...blobAuth() });
    if (!res || res.statusCode !== 200) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return new Response(res.stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
        ETag: res.blob.etag,
      },
    });
  } catch (e: any) {
    if (e?.name === "BlobNotFoundError") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return fail(e);
  }
}

export async function PUT(req: NextRequest) {
  if (!configured()) return notConfigured();
  const p = parse(req);
  if (!p) return NextResponse.json({ error: "Bad vault or key." }, { status: 400 });

  const body = await req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `Sync item is ${(body.byteLength / 1e6).toFixed(1)} MB; the limit is 4 MB.` },
      { status: 413 }
    );
  }
  const ifMatch = req.headers.get("if-match") ?? undefined;

  try {
    const blob = await put(p.path, Buffer.from(body), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
      cacheControlMaxAge: 60,
      ...(ifMatch ? { ifMatch } : {}),
      ...blobAuth(),
    });
    return NextResponse.json({ etag: blob.etag });
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) {
      return NextResponse.json({ error: "Changed on another device." }, { status: 412 });
    }
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  if (!configured()) return notConfigured();
  const p = parse(req, true);
  if (!p) return NextResponse.json({ error: "Bad vault or key." }, { status: 400 });

  try {
    if (p.key === "all") {
      await deletePrefix(`vaults/${p.vault}/`);
    } else {
      await del(p.path, { ...blobAuth() });
      if (p.key.startsWith("conv/")) {
        await deletePrefix(`vaults/${p.vault}/img/${p.key.slice(5)}/`);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
