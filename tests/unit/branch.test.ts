import { test } from "node:test";
import assert from "node:assert/strict";
import { branchConversation } from "../../lib/branch";
import { DEFAULT_PARAMS, type Conversation } from "../../lib/types";

const source = (): Conversation => ({
  id: "original", title: "A story", createdAt: 1, updatedAt: 2, providerId: "provider", model: "model",
  personaId: "persona", params: { ...DEFAULT_PARAMS, systemPrompt: "Be concise" },
  messages: [
    { id: "u1", role: "user", content: "First prompt", createdAt: 1 },
    { id: "a1", role: "assistant", content: "First answer", createdAt: 2, usage: { input: 3, output: 4 } },
    { id: "u2", role: "user", content: "Original prompt", createdAt: 3, attachments: [{ id: "file", name: "notes.txt", kind: "text", text: "Notes", mime: "text/plain", size: 5 }] },
    { id: "a2", role: "assistant", content: "Original ending", createdAt: 4 },
  ],
});

test("branch keeps preceding context, edits only the selected prompt, and preserves original", () => {
  const original = source();
  const before = structuredClone(original);
  const branch = branchConversation(original, "u2", "  Another ending  ");
  assert.notEqual(branch.id, original.id);
  assert.equal(branch.title, "A story · branch");
  assert.deepEqual(branch.messages.map(m => m.content), ["First prompt", "First answer", "Another ending"]);
  assert.equal(branch.providerId, original.providerId);
  assert.equal(branch.model, original.model);
  assert.equal(branch.personaId, original.personaId);
  assert.deepEqual(branch.params, original.params);
  assert.equal(branch.messages[2].attachments?.[0].text, "Notes");
  branch.messages[2].attachments![0].text = "Changed";
  branch.params.systemPrompt = "Changed";
  branch.messages[1].usage!.input = 50;
  assert.deepEqual(original, before);
  assert.ok(branch.messages.every(m => !original.messages.some(o => o.id === m.id)));
});

test("rejects invalid branch points and empty prompts without attachments", () => {
  assert.throws(() => branchConversation(source(), "missing", "Hi"));
  assert.throws(() => branchConversation(source(), "a1", "Hi"));
  assert.throws(() => branchConversation(source(), "u1", "  "));
  assert.equal(branchConversation(source(), "u2", "").messages.length, 3);
});

test("missing synced images cannot silently disappear into a branch", () => {
  const original = source();
  original.messages[0].attachments = [{ id: "image", kind: "image", name: "remote.png", mime: "image/png", size: 1 }];
  assert.throws(() => branchConversation(original, "u2", "Revised"), /not available on this device/);
  assert.equal(original.messages.length, 4);
});
