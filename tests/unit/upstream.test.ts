import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUpstreamCall, parseSse } from "../../lib/server/upstream";
import { DEFAULT_PARAMS, type ChatRequest } from "../../lib/types";

const req: ChatRequest = { kind: "custom", apiKey: "", baseUrl: "http://localhost:1234/v1/", model: "test", params: DEFAULT_PARAMS, messages: [{ role: "user", content: "Hello" }] };
function bytes(text: string) {
  const buffer = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < buffer.length; i += 3) controller.enqueue(buffer.slice(i, i + 3));
    controller.close();
  } });
}
async function collect(text: string, flavor: "openai" | "anthropic" | "gemini" = "openai") {
  const result = [];
  for await (const event of parseSse(bytes(text), flavor)) result.push(event);
  return result;
}

test("keyless custom providers and user headers use the expected endpoint", () => {
  const call = buildUpstreamCall({ ...req, headers: { "api-key": "test-header" } });
  assert.equal(call.url, "http://localhost:1234/v1/chat/completions");
  assert.equal(call.headers.Authorization, undefined);
  assert.equal(call.headers["api-key"], "test-header");
  assert.deepEqual(JSON.parse(call.body).messages, req.messages);
});

test("OpenAI reasoning models omit unsupported sampling fields", () => {
  const call = buildUpstreamCall({ ...req, kind: "openai", model: "o3" });
  const body = JSON.parse(call.body);
  assert.equal(body.temperature, undefined);
  assert.equal(body.top_p, undefined);
});

test("decodes chunked UTF-8, CRLF, usage and a final line without a newline", async () => {
  const result = await collect('data: {"choices":[{"delta":{"content":"Hello 🌿"}}]}\r\n\r\ndata: {"usage":{"prompt_tokens":5,"completion_tokens":3},"choices":[]}');
  assert.deepEqual(result, [{ type: "text", text: "Hello 🌿" }, { type: "usage", input: 5, output: 3 }]);
});

test("decodes Anthropic thinking, text and accumulated usage", async () => {
  const events = [
    { type: "message_start", message: { usage: { input_tokens: 8 } } },
    { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "Think" } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "Answer" } },
    { type: "message_delta", usage: { output_tokens: 4 } },
  ];
  assert.deepEqual(await collect(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(""), "anthropic"), [
    { type: "reasoning", text: "Think" }, { type: "text", text: "Answer" }, { type: "usage", input: 8, output: 4 },
  ]);
});

test("decodes Gemini plain JSON responses", async () => {
  assert.deepEqual(await collect(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hi" }] } }] }), "gemini"), [{ type: "text", text: "Hi" }]);
});

test("propagates an error received after partial text", async () => {
  const iterator = parseSse(bytes('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\ndata: {"error":{"message":"Stream failed"}}\n'), "openai");
  assert.deepEqual((await iterator.next()).value, { type: "text", text: "Partial" });
  await assert.rejects(iterator.next(), /Stream failed/);
});
