import { test, expect, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
}
function pdf(text: string) {
  const stream = text ? `BT /F1 12 Tf 20 100 Td (${text}) Tj ET` : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let data = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(data.length); data += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = data.length;
  data += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(data);
}

test("mixed uploads keep valid code, explain invalid files, and allow preview/removal", async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: "app.ts", mimeType: "text/plain", buffer: Buffer.from("const answer: number = 42;") },
    { name: "bad.bin", mimeType: "application/octet-stream", buffer: Buffer.from([0, 1, 0, 2]) },
  ]);
  await expect(page.getByRole("alert", { name: "Attachment errors" })).toContainText("Unsupported binary");
  await page.getByRole("button", { name: "Preview app.ts" }).click();
  await expect(page.getByRole("region", { name: "Attachment preview: app.ts" })).toContainText("const answer: number = 42;");
  await expect(page.getByRole("button", { name: "Toggle image generation" })).toBeDisabled();
  await page.getByRole("button", { name: "Remove app.ts" }).click();
  await expect(page.getByRole("button", { name: "Toggle image generation" })).toBeEnabled();
});

test("PDF extraction uses a local worker without an external CDN", async ({ page }) => {
  await open(page);
  const workers: string[] = [];
  page.on("request", request => { if (request.url().includes("pdf.worker")) workers.push(request.url()); });
  await page.route("**/unpkg.com/**", route => route.abort());
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: pdf("Hello from PDF") });
  await page.getByRole("button", { name: "Preview notes.pdf" }).click();
  await expect(page.getByRole("region", { name: "Attachment preview: notes.pdf" })).toContainText("Hello from PDF");
  expect(workers.length).toBeGreaterThan(0);
  expect(workers.every(url => url.startsWith("http://127.0.0.1:3100/"))).toBe(true);
});

test("image-only PDFs explain that OCR is needed", async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: pdf("") });
  await expect(page.getByRole("alert", { name: "Attachment errors" })).toContainText("no selectable text");
  await expect(page.getByRole("button", { name: "Preview scan.pdf" })).toHaveCount(0);
});

test("attachment count is limited before reading excessive files", async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles(Array.from({ length: 11 }, (_, i) => ({ name: `file-${i}.txt`, mimeType: "text/plain", buffer: Buffer.from("Notes") })));
  await expect(page.getByRole("button", { name: /^Preview file-/ })).toHaveCount(10);
  await expect(page.getByRole("alert", { name: "Attachment errors" })).toContainText("up to 10 files");
});

test("code blocks support wrapping, download, and a clipboard fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const params = { temperature: 0.8, topP: 1, maxTokens: 4096, systemPrompt: "" };
    localStorage.setItem("newfrontend-store", JSON.stringify({ version: 0, state: {
      providers: [], conversations: [{ id: "code", title: "Code test", providerId: null, model: null, params, createdAt: 1, updatedAt: 1,
        messages: [{ id: "m", role: "assistant", content: "```typescript\nconst answer: number = 42;\n```", createdAt: 1 }] }],
      activeId: "code", uiTheme: "dark", presets: [], snippets: [], themes: [], regexScripts: [], personas: [],
    } }));
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });
  await open(page);
  await page.getByRole("button", { name: "Toggle code wrapping" }).click();
  await expect(page.getByRole("button", { name: "Toggle code wrapping" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("pre")).toHaveCSS("white-space", "pre-wrap");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download code" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("snippet.ts");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString("utf8")).toBe("const answer: number = 42;\n");
  await page.getByRole("button", { name: "Copy code", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Copy is unavailable");
});

test("combined attachment limits reject extra data while retaining accepted files", async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: "first.txt", mimeType: "text/plain", buffer: Buffer.alloc(2_000_000, "a") },
    { name: "second.txt", mimeType: "text/plain", buffer: Buffer.alloc(2_000_000, "b") },
  ]);
  await expect(page.getByRole("alert", { name: "Attachment errors" })).toContainText("combined attachments are too large");
  await expect(page.getByRole("button", { name: "Preview first.txt" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview second.txt" })).toHaveCount(0);
});

test("source attachments reach the model with nested fences preserved", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("newfrontend-store", JSON.stringify({ version: 0, state: {
      providers: [{ id: "p", kind: "custom", label: "Local", apiKey: "", baseUrl: "http://127.0.0.1:9999/v1", enabled: true, defaultModel: "test" }],
      conversations: [], activeId: null, uiTheme: "dark", presets: [], snippets: [], themes: [], regexScripts: [], personas: [],
    } }));
  });
  await page.route("**/api/models", route => route.fulfill({ json: { models: [{ id: "test" }] } }));
  let content = "";
  await page.route("**/api/chat", route => {
    content = route.request().postDataJSON().messages.at(-1).content;
    return route.fulfill({ contentType: "application/x-ndjson", body: '{"t":"d","v":"Reviewed"}\n' });
  });
  await open(page);
  const source = "# Notes\n```ts\nconst x = 1;\n```";
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from(source) });
  await page.getByRole("button", { name: "Preview notes.md" }).waitFor();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Review this");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Reviewed", { exact: true })).toBeVisible();
  expect(content).toContain("Review this");
  expect(content).toContain("````md\n" + source + "\n````");
});
