import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DRAFT, buildPreset, parsePreset, presetFilename } from "../../lib/sillytavern";
import { DEFAULT_THEME, buildTheme, parseTheme, themeFilename } from "../../lib/sillytavern-theme";
import { DEFAULT_REGEX, buildRegexScript, parseRegexScript, regexFilename } from "../../lib/sillytavern-regex";
import { personaFilename } from "../../lib/personas";
import { conversationMarkdown } from "../../lib/export-chat";
import { DEFAULT_PARAMS } from "../../lib/types";

test("preset JSON retains the prompts and sampling settings when parsed again", () => {
  const draft = { ...DEFAULT_DRAFT, name: "Writing", mainPrompt: "Help me write.", temperature: 0.65, maxTokens: 2048 };
  const restored = parsePreset(JSON.parse(JSON.stringify(buildPreset(draft))), draft.name);
  assert.equal(restored.mainPrompt, draft.mainPrompt);
  assert.equal(restored.temperature, draft.temperature);
  assert.equal(restored.maxTokens, draft.maxTokens);
});
test("theme and regex JSON preserve editable settings when parsed again", () => {
  const theme = { ...DEFAULT_THEME, name: "Warm", fontScale: 1.2 };
  assert.equal(parseTheme(JSON.parse(JSON.stringify(buildTheme(theme)))).fontScale, 1.2);
  const regex = { ...DEFAULT_REGEX, scriptName: "Cleanup", findRegex: "/foo/g", replaceString: "bar" };
  const restored = parseRegexScript(JSON.parse(JSON.stringify(buildRegexScript(regex))));
  assert.equal(restored.findRegex, regex.findRegex);
  assert.equal(restored.replaceString, regex.replaceString);
});
test("builder filenames preserve Unicode and avoid duplicate extensions", () => {
  for (const make of [presetFilename, themeFilename, regexFilename, personaFilename]) {
    assert.equal(make("Résumé.json"), "Résumé.json");
    assert.equal(make("../../CON"), "_CON.json");
  }
});
test("transcripts include text attachments, name images and retain request errors", () => {
  const markdown = conversationMarkdown({ id: "c", title: "Conversation", providerId: "private-provider-id", model: "test", params: DEFAULT_PARAMS, createdAt: 1, updatedAt: 1,
    messages: [{ id: "m", role: "assistant", content: "Partial answer", createdAt: 1, error: "Interrupted", attachments: [{ id: "t", name: "notes.txt", mime: "text/plain", size: 4, kind: "text", text: "Notes" }, { id: "i", name: "picture.png", mime: "image/png", kind: "image", dataUrl: "private-image-bytes", size: 4 }] }] });
  assert.match(markdown, /Notes/);
  assert.match(markdown, /picture.png/);
  assert.match(markdown, /Interrupted/);
  assert.doesNotMatch(markdown, /private-provider-id|private-image-bytes/);
});
