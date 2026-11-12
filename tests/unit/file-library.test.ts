import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { collectLibraryFiles, makeLibraryFile, validateLibraryFiles } from "../../lib/file-library";
import { archivePaths, createProjectZip } from "../../lib/project-zip";
import { safeProjectPath, splitGeneratedFiles } from "../../lib/generated-files";
import { useStore } from "../../lib/store";
import { DEFAULT_PARAMS } from "../../lib/types";
import { buildBackup, validateBackup } from "../../lib/backup";

const conversation = { id: "c", title: "Project", providerId: null, model: null, params: DEFAULT_PARAMS, createdAt: 1, updatedAt: 1,
  messages: [{ id: "m", role: "assistant" as const, content: '```typescript filename="src/main.ts"\nexport const x = 1;\n```', createdAt: 1 }] };
test("indexes completed files across chats without duplicating kept files", () => {
  const files = collectLibraryFiles([conversation], []);
  assert.equal(files.length, 1);
  assert.equal(files[0].versions[0].path, "src/main.ts");
  assert.equal(collectLibraryFiles([conversation], files).length, 1);
  assert.equal(collectLibraryFiles([{ ...conversation, messages: [{ ...conversation.messages[0], streaming: true }] }], []).length, 0);
  assert.equal(collectLibraryFiles([], files).length, 1);
});
test("new versions retain original source and survive deleting a conversation", () => {
  useStore.setState(useStore.getInitialState(), true);
  const original = collectLibraryFiles([conversation], [])[0];
  const id = useStore.getState().saveFileVersion(original, "main.ts", "export const x = 2;", "src/main.ts");
  const saved = useStore.getState().libraryFiles[0];
  assert.equal(saved.versions.length, 2);
  assert.equal(saved.versions[1].id, id);
  assert.equal(saved.versions[0].content, "export const x = 1;");
  assert.equal(collectLibraryFiles([], [saved])[0].versions[1].content, "export const x = 2;");
  const before = useStore.getState().libraryFiles;
  assert.throws(() => useStore.getState().saveFileVersion(original, "too-big.txt", "x".repeat(2_000_001)), /library limit/);
  assert.equal(useStore.getState().libraryFiles, before);
  useStore.setState(useStore.getInitialState(), true);
});
test("kept files and all versions round-trip in backups", () => {
  const file = makeLibraryFile("kept", "test.txt", "Hello", 1);
  const backup = buildBackup({ ...useStore.getInitialState(), libraryFiles: [file] }, { includeKeys: false, includeConversations: false });
  const result = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(result.ok, true);
  assert.deepEqual(backup.libraryFiles, [file]);
  assert.equal(validateLibraryFiles([{ id: "bad", versions: [] }]), false);
  useStore.getState().importBackup(backup, "merge");
  assert.deepEqual(useStore.getState().libraryFiles, [file]);
  useStore.setState(useStore.getInitialState(), true);
});
test("project paths reject traversal and retain dotfiles and extensionless files", () => {
  for (const name of ["../bad.js", "/root.js", "C:\\file.js", "a/../bad.js"]) assert.equal(safeProjectPath(name), undefined);
  for (const name of ["src/main.ts", "my folder/main file.ts", ".gitignore", "Dockerfile"]) assert.equal(safeProjectPath(name), name);
  const parts = splitGeneratedFiles('```text filename="Dockerfile"\nFROM node:24\n```\n```text filename=".gitignore"\nnode_modules\n```');
  assert.deepEqual(parts.filter((part) => part.kind === "file").map((part) => part.filename), ["Dockerfile", ".gitignore"]);
});
test("ZIP creation preserves folders, disambiguates duplicate names, and contains exact file contents", async () => {
  const files = [
    { id: "1", filename: "index.html", content: "<h1>Hello</h1>", createdAt: 1 },
    { id: "2", filename: "main.ts", path: "src/main.ts", content: "export const x = 1;", createdAt: 1 },
    { id: "3", filename: "main.ts", path: "src/main.ts", content: "export const x = 2;", createdAt: 1 },
    { id: "4", filename: "Dockerfile", content: "FROM node:24", createdAt: 1 },
  ];
  assert.deepEqual(archivePaths(files), ["index.html", "src/main.ts", "src/main-2.ts", "Dockerfile"]);
  const zip = await JSZip.loadAsync(await (await createProjectZip(files)).arrayBuffer());
  assert.equal(await zip.file("src/main.ts")!.async("string"), files[1].content);
  assert.equal(await zip.file("src/main-2.ts")!.async("string"), files[2].content);
  assert.equal(await zip.file("Dockerfile")!.async("string"), "FROM node:24");
  await assert.rejects(createProjectZip([{ ...files[0], path: "../bad.html" }]), /Invalid project path/);
});
