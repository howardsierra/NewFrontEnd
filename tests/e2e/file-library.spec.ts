import { test, expect, type Page } from "@playwright/test";
import JSZip from "jszip";
import { createDocument } from "../../lib/documents";

const code = '```html filename="index.html"\n<h1>Original</h1>\n```\n\n```css filename="src/style.css"\nh1 { color: purple; }\n```';
async function seed(page: Page) {
  await page.addInitScript(({ code }) => {
    if (localStorage.getItem("newfrontend-store")) return;
    const params = { temperature: 0.8, topP: 1, maxTokens: 4096, systemPrompt: "" };
    localStorage.setItem("newfrontend-store", JSON.stringify({ version: 0, state: {
      providers: [{ id: "p", kind: "custom", label: "Local", apiKey: "", baseUrl: "http://127.0.0.1:9999", enabled: true, defaultModel: "test" }],
      conversations: [
        { id: "project", title: "Website project", providerId: "p", model: "test", params, createdAt: 1, updatedAt: 1, messages: [{ id: "m", role: "assistant", content: code, createdAt: 1 }] },
        { id: "notes", title: "Planning notes", providerId: "p", model: "test", params, createdAt: 2, updatedAt: 2, messages: [{ id: "n", role: "assistant", content: '```markdown filename="plan.pdf"\n# Future ideas\nA new project\n```', createdAt: 2 }] },
      ], activeId: "project", uiTheme: "dark", presets: [], snippets: [], themes: [], regexScripts: [], personas: [],
    } }));
  }, { code });
  await page.route("**/api/models", route => route.fulfill({ json: { models: [{ id: "test" }] } }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Download index.html", exact: true })).toBeVisible();
}
async function readDownload(page: Page, click: () => Promise<unknown>) {
  const downloading = page.waitForEvent("download");
  await click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

test("edits save separate versions, download edited contents, and persist in the file library", async ({ page }) => {
  await seed(page);
  const file = page.getByRole("region", { name: "Generated file: index.html", exact: true });
  await file.getByRole("button", { name: "Preview & edit" }).click();
  await file.getByRole("button", { name: "Edit content", exact: true }).click();
  await file.getByRole("textbox", { name: "Edit content of index.html", exact: true }).fill("<h1>Edited</h1>");
  await file.getByRole("button", { name: "Save new version" }).click();
  await expect(file.getByRole("status")).toContainText("New version saved");
  await expect(file.getByLabel("Version of index.html")).toHaveValue(/.+/);
  const downloaded = await readDownload(page, () => file.getByRole("button", { name: "Download index.html", exact: true }).click());
  expect(downloaded.bytes.toString()).toBe("<h1>Edited</h1>");
  await file.getByLabel("Version of index.html").selectOption({ index: 0 });
  await expect(file.getByRole("textbox", { name: "Edit content of index.html" })).toHaveValue("<h1>Original</h1>");
  await page.reload();
  await page.getByRole("button", { name: "File library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "File library" });
  await library.getByRole("button", { name: /index.html.*Kept copy/ }).click();
  await expect(library.getByRole("region", { name: "Generated file: index.html" })).toContainText("Kept in library");
  await expect(library.getByLabel("Version of index.html").locator("option")).toHaveCount(2);
  await library.getByRole("button", { name: "Preview & edit" }).click();
  await page.screenshot({ path: "/tmp/file-library-desktop.png", fullPage: true });
});

test("library finds files across chats, filters content/type, and retained copies survive chat deletion", async ({ page }) => {
  await seed(page);
  await page.getByRole("region", { name: "Generated file: index.html", exact: true }).getByLabel("File actions for index.html").click();
  await page.getByRole("region", { name: "Generated file: index.html", exact: true }).getByRole("button", { name: "Keep in library" }).click();
  page.once("dialog", dialog => dialog.accept());
  const projectRow = page.getByRole("button", { name: "Website project", exact: true }).locator("..");
  await projectRow.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "File library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "File library" });
  await library.getByRole("textbox", { name: "Search files" }).fill("Future ideas");
  await expect(library.getByRole("button", { name: /plan.pdf.*From chat/ })).toBeVisible();
  await library.getByRole("textbox", { name: "Search files" }).fill("Original");
  await expect(library.getByRole("button", { name: /index.html.*Kept copy/ })).toBeVisible();
  await library.getByRole("textbox", { name: "Search files" }).fill("");
  await library.getByRole("combobox", { name: "File type" }).selectOption("pdf");
  await expect(library.getByRole("button", { name: /index.html.*Kept copy/ })).toHaveCount(0);
  await library.getByRole("textbox", { name: "Search files" }).fill("does-not-exist");
  await expect(library.getByRole("status")).toContainText("No files match");
});

test("project ZIP preserves folders and includes the latest saved version", async ({ page }) => {
  await seed(page);
  const file = page.getByRole("region", { name: "Generated file: index.html", exact: true });
  await file.getByRole("button", { name: "Preview & edit" }).click();
  await file.getByRole("button", { name: "Edit content", exact: true }).click();
  await file.getByRole("textbox", { name: "Edit content of index.html" }).fill("<h1>ZIP version</h1>");
  await file.getByRole("button", { name: "Save new version" }).click();
  const result = await readDownload(page, () => page.getByRole("button", { name: "Download ZIP (2)", exact: true }).click());
  const zip = await JSZip.loadAsync(result.bytes);
  expect(await zip.file("index.html")!.async("string")).toBe("<h1>ZIP version</h1>");
  expect(await zip.file("src/style.css")!.async("string")).toBe("h1 { color: purple; }");
});

test("revise with AI attaches the current version and requests a complete revised file", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "File library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "File library" });
  await library.getByRole("button", { name: /index.html.*From chat/ }).click();
  await library.getByLabel("File actions for index.html").click();
  await library.getByRole("button", { name: "Revise with AI", exact: true }).click();
  await expect(library).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview index.html" })).toBeVisible();
  const input = page.getByRole("textbox", { name: "Message", exact: true });
  await expect(input).toHaveValue(/Revise index.html/);
  await input.fill("Revise index.html. Change the heading to Updated and return the complete file.");
  let sent = "";
  await page.route("**/api/chat", route => {
    sent = route.request().postDataJSON().messages.at(-1).content;
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ t: "d", v: '```html filename="index.html"\n<h1>Updated</h1>\n```' }) + "\n" });
  });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download index.html", exact: true })).toHaveCount(2);
  expect(sent).toContain("<h1>Original</h1>");
  expect(sent).toContain("complete file");
  await page.getByRole("button", { name: "File library", exact: true }).click();
  const restored = page.getByRole("dialog", { name: "File library" });
  await restored.getByRole("button", { name: /index.html.*Kept copy/ }).click();
  await expect(restored.getByLabel("Version of index.html").locator("option")).toHaveCount(2);
});

test("Word upload extracts editable text and can be prepared for revision", async ({ page }) => {
  await seed(page);
  const blob = await createDocument("notes.docx", "# Draft\n\nPlease revise this paragraph.");
  await page.getByRole("button", { name: "File library", exact: true }).click();
  await page.getByRole("dialog", { name: "File library" }).locator('input[type="file"]').setInputFiles({ name: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from(await blob.arrayBuffer()) });
  await page.getByRole("button", { name: "Preview notes.docx" }).click();
  const preview = page.getByRole("region", { name: "Attachment preview: notes.docx" });
  await expect(preview).toContainText("Please revise this paragraph.");
  await preview.getByRole("button", { name: "Revise this file with AI" }).click();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(/Revise notes.docx/);
});

test("file library selection downloads a ZIP on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page.getByRole("button", { name: "File library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "File library" });
  await library.getByRole("checkbox", { name: "Select index.html", exact: true }).check();
  await library.getByRole("checkbox", { name: "Select src/style.css", exact: true }).check();
  const result = await readDownload(page, () => library.getByRole("button", { name: "Download ZIP (2)", exact: true }).click());
  expect(Object.keys((await JSZip.loadAsync(result.bytes)).files)).toContain("src/style.css");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/file-library-mobile.png", fullPage: true });
});

test("a storage failure does not falsely report that a file was kept", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "newfrontend-store") throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const file = page.getByRole("region", { name: "Generated file: index.html", exact: true });
  await file.getByLabel("File actions for index.html").click();
  await file.getByRole("button", { name: "Keep in library" }).click();
  await expect(file.getByRole("alert")).toContainText("could not save the file library");
  await expect(file).not.toContainText("Kept in library");
});
