import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page, content = "") {
  await page.addInitScript(({ content }) => {
    if (localStorage.getItem("newfrontend-store")) return;
    localStorage.setItem("newfrontend-store", JSON.stringify({ version: 0, state: {
      providers: [], conversations: [{ id: "studio", title: "Writing studio", createdAt: 1, updatedAt: 1, providerId: null, model: null,
        params: { temperature: 0.8, topP: 1, maxTokens: 4096, systemPrompt: "" }, messages: content ? [{ id: "a", role: "assistant", content, createdAt: 1 }] : [] }],
      activeId: "studio", uiTheme: "dark", presets: [], snippets: [], themes: [], regexScripts: [], personas: [],
    } }));
  }, { content });
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
}
async function checkTextContrast(page: Page) {
  const ratios = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim().split(/\s+/).map(Number);
    const lum = (rgb: number[]) => rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    return [contrast(read("--c-ink-muted"), read("--c-bg")), contrast(read("--c-ink-faint"), read("--c-bg-panel")), contrast([255, 255, 255], read("--c-accent"))];
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
}

test("studio navigation keeps files prominent and reveals builders with the keyboard", async ({ page }) => {
  await seed(page);
  await expect(page.getByRole("button", { name: "File library", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Prompt library", exact: true })).toHaveCount(0);
  const tools = page.getByText("Studio tools", { exact: true }).filter({ visible: true });
  await tools.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Prompt library", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Prompt library", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Prompt/ })).toBeVisible();
});

test("dark and light studio themes have readable text and persist after reload", async ({ page }) => {
  await seed(page);
  await checkTextContrast(page);
  await page.screenshot({ path: "/tmp/flux-studio-dark.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await checkTextContrast(page);
  await page.screenshot({ path: "/tmp/flux-studio-light.png", fullPage: true, animations: "disabled" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("paper previews, file menus, and highlighted code work in both themes", async ({ page }) => {
  await seed(page, '```markdown filename="chapter.pdf"\n# A place to begin\n\nA quiet space for **good ideas**.\n\n## Notes for tomorrow\n\n- Write a little\n- Make something useful\n```\n\n```html filename="page.html"\n<script>window.untrustedRan = true;</script>\n<h1>Hello</h1>\n```');
  const document = page.getByRole("region", { name: "Generated file: chapter.pdf", exact: true });
  await expect(document.getByRole("button", { name: "Keep in library" })).toHaveCount(0);
  const menu = document.getByLabel("File actions for chapter.pdf");
  await menu.focus();
  await menu.press("Enter");
  await document.getByRole("button", { name: "Keep in library" }).click();
  await expect(document.getByRole("status")).toContainText("Kept in File library");
  await document.getByRole("button", { name: "Preview & edit" }).click();
  await expect(document.getByRole("article", { name: "Document preview" })).toContainText("good ideas");
  const code = page.getByRole("region", { name: "Generated file: page.html", exact: true });
  await code.getByRole("button", { name: "Preview & edit" }).click();
  await expect(code.locator(".code-preview")).toContainText("window.untrustedRan = true;");
  expect(await page.evaluate(() => (window as Window & { untrustedRan?: boolean }).untrustedRan)).toBeUndefined();
  await page.getByRole("button", { name: "File library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "File library" });
  await library.getByRole("button", { name: /chapter.pdf.*Kept copy/ }).click();
  await library.getByRole("button", { name: "Preview & edit" }).click();
  await page.screenshot({ path: "/tmp/flux-studio-library-dark.png", fullPage: true, animations: "disabled" });
  await library.getByRole("button", { name: "Close file library" }).click();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("button", { name: "File library", exact: true }).click();
  await library.getByRole("button", { name: /chapter.pdf.*Kept copy/ }).click();
  await library.getByRole("button", { name: "Preview & edit" }).click();
  await expect(library.getByRole("article", { name: "Document preview" })).toContainText("A place to begin");
  await page.screenshot({ path: "/tmp/flux-studio-library-light.png", fullPage: true, animations: "disabled" });
});

test("mobile navigation and file action menu fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, '```markdown filename="draft.pdf"\n# First draft\n\nSomewhere to start.\n```');
  const file = page.getByRole("region", { name: "Generated file: draft.pdf", exact: true });
  await file.getByLabel("File actions for draft.pdf").click();
  await expect(file.getByRole("button", { name: "Keep in library" })).toBeVisible();
  await file.getByRole("button", { name: "Keep in library" }).click();
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page.getByRole("button", { name: "File library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "File library" });
  await library.getByRole("button", { name: "Preview & edit" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/flux-studio-mobile.png", fullPage: true, animations: "disabled" });
});
