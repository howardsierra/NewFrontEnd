import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFile, attachmentToPrompt, MAX_TEXT_BYTES } from "../../lib/files";
import { codeFilename } from "../../lib/code-files";

test("reads source code and extensionless files as UTF-8", async () => {
  for (const name of ["app.tsx", "Dockerfile", "notes.unknown"]) {
    const attachment = await parseFile(new File(["Hello 🌿"], name));
    assert.equal(attachment.kind, "text");
    assert.equal(attachment.text, "Hello 🌿");
  }
});
test("rejects large files before reading, including unknown extensions and PDFs", async () => {
  for (const name of ["big.txt", "big.unknown", "big.pdf", "big.png"]) {
    const file = { name, type: "", size: 21 * 1024 * 1024, text: () => { throw new Error("Must not read"); } } as unknown as File;
    await assert.rejects(parseFile(file), /too large/);
  }
  assert.ok(MAX_TEXT_BYTES < 4_300_000);
});
test("rejects binary data even if its filename claims to be text", async () => {
  await assert.rejects(parseFile(new File([new Uint8Array([0, 1, 2, 0, 3])], "binary.txt", { type: "text/plain" })), /Unsupported binary/);
});
test("nested code fences cannot close an attachment's prompt block", () => {
  const content = "A markdown document\n```js\nconsole.log('hi');\n```";
  const prompt = attachmentToPrompt({ id: "a", name: "example.md", kind: "text", text: content, size: content.length, mime: "text/markdown" });
  assert.ok(prompt.includes("\n````md\n" + content + "\n````"));
  assert.equal(attachmentToPrompt({ id: "i", name: "image.png", kind: "image", size: 1, mime: "image/png" }), "");
});
test("code downloads use a recognized extension or fall back to plain text", () => {
  assert.equal(codeFilename("typescript"), "snippet.ts");
  assert.equal(codeFilename("PYTHON"), "snippet.py");
  assert.equal(codeFilename("../../shell.exe"), "snippet.txt");
});
