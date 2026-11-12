import { test } from "node:test";
import assert from "node:assert/strict";
import { providerFailure } from "../../lib/request-errors";

for (const [status, detail, code] of [
  [401, "", "authentication"], [403, "", "authentication"], [429, "", "rate_limit"],
  [429, "insufficient_quota", "quota"], [402, "", "quota"], [404, "", "model"], [400, "Model does not exist", "model"],
  [400, "maximum context length exceeded", "context"], [413, "", "context"],
  [503, "", "provider"], [400, "Invalid temperature", "invalid_request"],
] as const) {
  test(`classifies ${status} ${detail}`, () => assert.equal(providerFailure(status, detail).errorCode, code));
}

test("honors seconds and HTTP-date Retry-After, rejects invalid delays", () => {
  assert.equal(providerFailure(429, "", "12").retryAfterSeconds, 12);
  const delay = providerFailure(429, "", new Date(Date.now() + 60_000).toUTCString()).retryAfterSeconds!;
  assert.ok(delay >= 59 && delay <= 60);
  for (const value of ["nonsense", "-5", "0"]) assert.equal(providerFailure(429, "", value).retryAfterSeconds, undefined);
});

test("does not expose provider bodies that may include credentials", () => {
  assert.doesNotMatch(JSON.stringify(providerFailure(500, "credential-sentinel")), /credential-sentinel/);
});
