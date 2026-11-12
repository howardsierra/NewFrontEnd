import { test, expect, type Page } from "@playwright/test";

const params = { temperature: 0.8, topP: 1, maxTokens: 4096, systemPrompt: "Be concise" };
const messages = [
  { id: "u1", role: "user", content: "First prompt", createdAt: 1 },
  { id: "a1", role: "assistant", content: "First answer", createdAt: 2 },
  { id: "u2", role: "user", content: "Original ending", createdAt: 3 },
  { id: "a2", role: "assistant", content: "Keep this answer", createdAt: 4 },
];
async function seed(page: Page, populated = false) {
  await page.addInitScript(({ params, messages, populated }) => {
    if (localStorage.getItem("newfrontend-store")) return;
    localStorage.setItem("newfrontend-store", JSON.stringify({ version: 0, state: {
      providers: [{ id: "p", kind: "custom", label: "Test provider", apiKey: "", baseUrl: "http://127.0.0.1:9999/v1", enabled: true, defaultModel: "test" }],
      conversations: [{ id: "original", title: "Original chat", messages: populated ? messages : [], providerId: "p", model: "test", params, createdAt: 1, updatedAt: 1 }],
      activeId: "original", uiTheme: "dark", presets: [], snippets: [], themes: [], regexScripts: [], personas: [],
    } }));
  }, { params, messages, populated });
  await page.route("**/api/models", route => route.fulfill({ json: { models: [{ id: "test" }] } }));
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
}
const reply = (text: string) => JSON.stringify({ t: "d", v: text }) + "\n";

test("edit & branch sends prior context, preserves the original, and persists both chats", async ({ page }) => {
  await seed(page, true);
  let sent: { messages: { content: string }[] } | undefined;
  await page.route("**/api/chat", route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ contentType: "application/x-ndjson", body: reply("A new ending") });
  });
  await page.getByRole("button", { name: "Edit & branch", exact: true }).last().click();
  await page.getByRole("textbox", { name: "Edit prompt in a new branch" }).fill("Revised ending");
  await page.getByRole("button", { name: "Branch & send" }).click();
  await expect(page.getByText("A new ending", { exact: true })).toBeVisible();
  expect(sent?.messages[0].content).toContain("Be concise");
  expect(sent?.messages[0].content).toContain("File creation:");
  expect(sent?.messages.slice(1).map(m => m.content)).toEqual(["First prompt", "First answer", "Revised ending"]);
  await page.getByRole("button", { name: "Original chat", exact: true }).click();
  await expect(page.getByText("Keep this answer", { exact: true })).toBeVisible();
  await expect(page.getByText("Original ending", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Original chat · branch", exact: true })).toBeVisible();
});

test("cancelling an edit creates no branch or request", async ({ page }) => {
  await seed(page, true);
  let calls = 0;
  page.on("request", request => { if (request.url().endsWith("/api/chat")) calls++; });
  await page.getByRole("button", { name: "Edit & branch", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Edit prompt in a new branch" }).fill("Discard me");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Keep this answer", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: / · branch$/ })).toHaveCount(0);
  expect(calls).toBe(0);
});

test("failed chat retry replaces the error without duplicating the user prompt", async ({ page }) => {
  await seed(page);
  const requests: { messages: { role: string; content: string }[] }[] = [];
  await page.route("**/api/chat", route => {
    requests.push(route.request().postDataJSON());
    return requests.length === 1
      ? route.fulfill({ status: 503, json: { error: "The provider is temporarily unavailable.", errorCode: "provider" } })
      : route.fulfill({ contentType: "application/x-ndjson", body: reply("Recovered answer") });
  });
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Please help");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Request error" })).toContainText("temporarily unavailable");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Recovered answer", { exact: true })).toBeVisible();
  expect(requests[1].messages.filter(m => m.role === "user")).toEqual([{ role: "user", content: "Please help" }]);
  await expect(page.getByRole("alert", { name: "Request error" })).toHaveCount(0);
});

test("rate limit retry waits for the requested delay and never retries automatically", async ({ page }) => {
  await seed(page);
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/chat", route => {
    calls++;
    return route.fulfill({ status: 429, json: { error: "Too many requests. Wait, then retry.", errorCode: "rate_limit", retryAfterSeconds: 5 } });
  });
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Hi");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: /Retry in/ })).toBeDisabled();
  await page.clock.fastForward(6000);
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeEnabled();
  expect(calls).toBe(1);
});

test("authentication errors link directly to connection settings", async ({ page }) => {
  await seed(page);
  await page.route("**/api/chat", route => route.fulfill({ status: 401, json: { error: "Check your API key and account permissions.", errorCode: "authentication" } }));
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Hi");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("alert", { name: "Request error" }).getByRole("button", { name: "Providers & keys" }).click();
  await expect(page.getByRole("heading", { name: "Providers & API keys" })).toBeVisible();
});

test("an interrupted stream keeps partial text and shows a recovery action", async ({ page }) => {
  await seed(page);
  await page.route("**/api/chat", route => route.fulfill({ contentType: "application/x-ndjson", body: reply("Partial answer") + JSON.stringify({ t: "e", v: "The stream was interrupted." }) + "\n" }));
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Hi");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Partial answer", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert", { name: "Request error" })).toContainText("Partial reply kept");
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
});

test("image retry keeps image mode, prompt, and size without adding another user turn", async ({ page }) => {
  await seed(page);
  const requests: unknown[] = [];
  await page.route("**/api/image", route => {
    requests.push(route.request().postDataJSON());
    return requests.length === 1 ? route.fulfill({ status: 503, json: { error: "Image service unavailable", errorCode: "provider" } })
      : route.fulfill({ json: { image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1cAAAAASUVORK5CYII=" } });
  });
  await page.getByRole("button", { name: "Toggle image generation" }).click();
  await page.getByRole("textbox", { name: "Image prompt" }).fill("A small garden");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("img", { name: "A small garden.png" })).toBeVisible();
  expect(requests[1]).toEqual(requests[0]);
  const roles = await page.evaluate(() => JSON.parse(localStorage.getItem("newfrontend-store")!).state.conversations[0].messages.map((m: { role: string }) => m.role));
  expect(roles).toEqual(["user", "assistant"]);
});

test("search, per-chat drafts, and Markdown export remain usable", async ({ page }) => {
  await seed(page, true);
  const input = page.getByRole("textbox", { name: "Message", exact: true });
  await input.fill("Original draft");
  await page.keyboard.press("Control+k");
  await expect(input).toHaveValue("");
  await input.fill("Second draft");
  const search = page.getByRole("textbox", { name: "Search conversations" }).first();
  await search.fill("First answer");
  await expect(page.getByRole("button", { name: "Original chat", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Original chat", exact: true }).click();
  await expect(input).toHaveValue("Original draft");
  await page.reload();
  await expect(input).toHaveValue("Original draft");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export chat" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("Original-chat.md");
  const stream = await download.createReadStream();
  const parts = [];
  for await (const part of stream!) parts.push(part);
  const text = Buffer.concat(parts).toString("utf8");
  expect(text).toContain("First answer");
  expect(text).not.toContain("apiKey");
});

test("branch editor and navigation work on a narrow mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, true);
  await page.route("**/api/chat", route => route.fulfill({ contentType: "application/x-ndjson", body: reply("Mobile branch answer") }));
  await page.getByRole("button", { name: "Edit & branch", exact: true }).last().click();
  await page.getByRole("textbox", { name: "Edit prompt in a new branch" }).fill("Mobile edit");
  await page.getByRole("button", { name: "Branch & send" }).click();
  await expect(page.getByText("Mobile branch answer", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page.getByRole("button", { name: "Original chat", exact: true }).click();
  await expect(page.getByText("Keep this answer", { exact: true })).toBeVisible();
});

test("missing images explain why branching is blocked without creating an incomplete chat", async ({ page }) => {
  await seed(page, true);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("newfrontend-store")!);
    data.state.conversations[0].messages[0].attachments = [{ id: "missing", kind: "image", name: "remote.png", mime: "image/png", size: 1 }];
    localStorage.setItem("newfrontend-store", JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole("button", { name: "Edit & branch", exact: true }).last().click();
  await page.getByRole("button", { name: "Branch & send" }).click();
  await expect(page.getByText(/An image in this history is not available/)).toBeVisible();
  await expect(page.getByRole("button", { name: / · branch$/ })).toHaveCount(0);
});
