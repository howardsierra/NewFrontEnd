import { test, expect, type Page } from "@playwright/test";
import JSZip from "jszip";

test.setTimeout(60_000);
async function seedReply(page: Page, content: string) {
  await page.addInitScript(({ content }) => {
    localStorage.setItem("newfrontend-store", JSON.stringify({ version: 0, state: {
      providers: [], conversations: [{ id: "files", title: "File creation", providerId: null, model: null, createdAt: 1, updatedAt: 1,
        params: { temperature: 0.8, topP: 1, maxTokens: 4096, systemPrompt: "" },
        messages: [{ id: "answer", role: "assistant", content, createdAt: 1 }] }], activeId: "files", uiTheme: "dark",
      presets: [], snippets: [], themes: [], regexScripts: [], personas: [],
    } }));
  }, { content });
  await page.goto("/");
}
async function downloadBytes(page: Page, name: string) {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: `Download ${name}`, exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(name);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("requested PDF becomes a real, readable multipage file", async ({ page }) => {
  const document = "# Résumé report\n\n" + Array.from({ length: 90 }, (_, i) => `Paragraph ${i + 1}: Findings from the report, with a clear explanation and supporting evidence.`).join("\n\n");
  await seedReply(page, '```markdown filename="report.pdf"\n' + document + '\n```');
  const bytes = await downloadBytes(page, "report.pdf");
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await page.locator('input[type="file"]').setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: bytes });
  await page.getByRole("button", { name: "Preview report.pdf" }).click();
  const preview = page.getByRole("region", { name: "Attachment preview: report.pdf" });
  await expect(preview).toContainText("Résumé report");
  await expect(preview).toContainText("--- Page 2 ---");
  await expect(preview).toContainText("Paragraph 90");
});

test("requested Word document is a valid DOCX containing the generated content", async ({ page }) => {
  await seedReply(page, '```markdown filename="proposal.docx"\n# Proposal\n\n**Important** project details.\n\n- First milestone\n\n| Item | Cost |\n|---|---|\n| Planning | 100 |\n```');
  const bytes = await downloadBytes(page, "proposal.docx");
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")!.async("string");
  expect(xml).toContain("Proposal");
  expect(xml).toContain("First milestone");
  expect(xml).toContain("w:tbl");
});

test("created JSON, CSV, and code download with correct names and contents", async ({ page }) => {
  await seedReply(page, '```json filename="data.json"\n{"answer":42}\n```\n\n```csv filename="résumé.csv"\nName,Score\nSierra,100\n```\n\n```python filename="hello.py"\nprint("Hello")\n```');
  expect(JSON.parse((await downloadBytes(page, "data.json")).toString())).toEqual({ answer: 42 });
  expect((await downloadBytes(page, "résumé.csv")).toString()).toBe("\uFEFFName,Score\nSierra,100");
  expect((await downloadBytes(page, "hello.py")).toString()).toBe('print("Hello")');
});

test("unsupported formats and invalid JSON do not become misleading downloads", async ({ page }) => {
  await seedReply(page, '```text filename="image.png"\nThis is not an image\n```\n\n```json filename="broken.json"\n{invalid}\n```');
  await expect(page.getByRole("button", { name: "Download image.png" })).toBeDisabled();
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Download broken.json" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "JSON is invalid" })).toBeVisible();
  expect(downloads).toBe(0);
});

test("ordinary replies can be saved as actual PDF files as a fallback", async ({ page }) => {
  await seedReply(page, "# A document\n\nThis reply can become a downloadable PDF.");
  await page.getByRole("button", { name: "Save reply as a file" }).click();
  await page.getByRole("textbox", { name: "Filename (include extension)" }).fill("my-report.pdf");
  expect((await downloadBytes(page, "my-report.pdf")).subarray(0, 5).toString()).toBe("%PDF-");
});

test("asking the model for a file uses the app's file protocol and renders a download card", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("newfrontend-store", JSON.stringify({ version: 0, state: {
    providers: [{ id: "p", kind: "custom", label: "Test", apiKey: "", baseUrl: "http://127.0.0.1:9999", enabled: true, defaultModel: "test" }],
    conversations: [], activeId: null, uiTheme: "dark", presets: [], snippets: [], themes: [], regexScripts: [], personas: [],
  } })));
  await page.route("**/api/models", route => route.fulfill({ json: { models: [{ id: "test" }] } }));
  let instructions = "";
  await page.route("**/api/chat", route => {
    instructions = route.request().postDataJSON().messages[0].content;
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ t: "d", v: '```markdown filename="plan.pdf"\n# Plan\n\n1. Start the project.\n```' }) + "\n" });
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Create a PDF project plan");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download plan.pdf" })).toBeVisible();
  expect(instructions).toContain('filename="report.pdf"');
  expect((await downloadBytes(page, "plan.pdf")).subarray(0, 5).toString()).toBe("%PDF-");
});
