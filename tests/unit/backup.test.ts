import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBackup, validateBackup } from "../../lib/backup";

const source = { providers: [{ id: "p", kind: "custom" as const, label: "Local", apiKey: "private-test-key", headers: { "api-key": "private-test-header" }, enabled: true }], presets: [], snippets: [], themes: [], regexScripts: [], personas: [], conversations: [] };
test("backup excludes keys and custom headers unless explicitly requested", () => {
  const backup = buildBackup(source, { includeKeys: false, includeConversations: false });
  assert.doesNotMatch(JSON.stringify(backup), /private-test/);
  assert.equal(backup.conversations, undefined);
  assert.equal(source.providers[0].apiKey, "private-test-key");
});
test("backup round-trips with conversations and opt-in keys", () => {
  const backup = buildBackup(source, { includeKeys: true, includeConversations: true });
  const result = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.providers[0].apiKey, "private-test-key");
  assert.deepEqual(backup.conversations, []);
});
test("backup rejects unrelated files, future versions, and missing sections", () => {
  const backup = buildBackup(source, { includeKeys: false, includeConversations: false });
  for (const value of [null, [], {}, { ...backup, kind: "other" }, { ...backup, version: 999 }, { ...backup, providers: null }]) {
    assert.equal(validateBackup(value).ok, false);
  }
});

test("merging an exported conversation preserves provider/persona links after ID changes", async () => {
  const { useStore } = await import("../../lib/store");
  const { DEFAULT_PERSONA } = await import("../../lib/personas");
  const { DEFAULT_PARAMS } = await import("../../lib/types");
  useStore.setState(useStore.getInitialState(), true);
  const backup = buildBackup({ ...source, personas: [{ ...DEFAULT_PERSONA, id: "persona", name: "Guide", updatedAt: 1 }], conversations: [{ id: "conversation", title: "Exported", providerId: "p", personaId: "persona", model: "test", params: DEFAULT_PARAMS, messages: [], createdAt: 1, updatedAt: 1 }] }, { includeKeys: false, includeConversations: true });
  useStore.getState().importBackup(backup, "merge");
  const restored = useStore.getState();
  assert.notEqual(restored.providers[0].id, "p");
  assert.equal(restored.conversations[0].providerId, restored.providers[0].id);
  assert.equal(restored.conversations[0].personaId, restored.personas[0].id);
  assert.equal(restored.providers[0].apiKey, "");
  useStore.setState(useStore.getInitialState(), true);
});
