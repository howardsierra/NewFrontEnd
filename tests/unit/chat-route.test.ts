import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/chat/route";
import { DEFAULT_PARAMS } from "../../lib/types";

const body = { kind: "custom", apiKey: "", model: "test", baseUrl: "http://localhost:1234/v1", params: DEFAULT_PARAMS, messages: [{ role: "user", content: "Hi" }] };
const request = (value: unknown) => new NextRequest("http://localhost/api/chat", { method: "POST", body: JSON.stringify(value), headers: { "Content-Type": "application/json" } });

test("chat route handles invalid JSON body shapes without throwing", async () => {
  assert.equal((await POST(request(null))).status, 400);
  assert.equal((await POST(request({}))).status, 400);
});

for (const status of [401, 404, 429, 503]) {
  test(`chat route preserves upstream status ${status} with safe actionable error`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: { message: "private-detail" } }), { status, headers: { "Retry-After": "10" } }));
    const res = await POST(request(body));
    const data = await res.json();
    assert.equal(res.status, status);
    assert.equal(typeof data.errorCode, "string");
    assert.doesNotMatch(data.error, /private-detail/);
    if (status === 429) assert.equal(data.retryAfterSeconds, 10);
  });
}

test("provider connection failure is explained without leaking exception details", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("private-detail"); });
  const res = await POST(request(body));
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.errorCode, "network");
  assert.doesNotMatch(data.error, /private-detail/);
});
