import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { splitGeneratedFiles, generatedFileFormat } from "../../lib/generated-files";
import { createDocument, pdfDefinition } from "../../lib/documents";
import { exportFilename } from "../../lib/download";

test("recognizes named files, preserves ordinary code, and waits for complete fences", () => {
  const source = 'Intro\n```ts\nconst x = 1;\n```\n\n```markdown filename="Résumé.pdf"\n# Résumé\nA document.\n```\nEnd';
  const parts = splitGeneratedFiles(source);
  assert.equal(parts.length, 3);
  assert.ok(parts[0].content.includes("const x = 1;"));
  assert.deepEqual(parts[1], { kind: "file", filename: "Résumé.pdf", language: "markdown", content: "# Résumé\nA document." });
  assert.equal(splitGeneratedFiles('```markdown filename="a.pdf"\nStill generating')[0].kind, "text");
});
test("multiple files retain complete content and portable filenames", () => {
  const parts = splitGeneratedFiles('```json filename="data.json"\n{"a":1}\n```\n```python filename="../hello.py"\nprint("hi")\n```');
  assert.deepEqual(parts.filter((part) => part.kind === "file").map((part) => part.filename), ["data.json", "hello.py"]);
  assert.equal(exportFilename("CON", "pdf"), "_CON.pdf");
  assert.equal(exportFilename("中文报告", "pdf"), "中文报告.pdf");
  assert.ok(new TextEncoder().encode(exportFilename("𐐀".repeat(200), "docx")).byteLength < 255);
});
test("unknown binary formats are rejected instead of fake file extensions", async () => {
  assert.throws(() => generatedFileFormat("slides.pptx"), /cannot be created/);
  await assert.rejects(createDocument("image.png", "pretend binary"), /cannot be created/);
});
test("JSON is validated and text/code files contain the exact generated source", async () => {
  await assert.rejects(createDocument("data.json", "{invalid}"), /JSON is invalid/);
  const text = 'print("Hello 🌿")\n';
  assert.equal(await (await createDocument("hello.py", text)).text(), text);
  assert.equal(await (await createDocument("data.json", '{"ok":true}')).text(), '{"ok":true}');
});
test("PDF layout includes headings, lists, tables and code", () => {
  const definition = pdfDefinition("# Heading\n\n- One\n- Two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nlet x = 1;\n```", "report.pdf");
  const serialized = JSON.stringify(definition);
  assert.match(serialized, /Heading/);
  assert.match(serialized, /headerRows/);
  assert.match(serialized, /let x = 1/);
});
test("Word creation produces an actual DOCX archive with headings and text", async () => {
  const blob = await createDocument("report.docx", "# Résumé\n\n**Important** findings.\n\n- Item one\n\n| A | B |\n|---|---|\n| 1 | 2 |");
  const data = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...data.slice(0, 2)), "PK");
  const zip = await JSZip.loadAsync(data);
  const document = await zip.file("word/document.xml")!.async("string");
  assert.match(document, /Résumé/);
  assert.match(document, /Important/);
  assert.match(document, /Heading1/);
  assert.match(document, /w:tbl/);
});
