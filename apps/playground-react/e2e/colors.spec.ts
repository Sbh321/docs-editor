import { expect, test } from "@playwright/test";

// Text color and highlight color, applied via `setMark`, rendered as inline
// styles, and carried into HTML export.

test("applies a text color to the selected text", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  await editable.click();
  await editable.selectText();
  await page.waitForTimeout(50);
  await page.getByLabel("Text color").fill("#ff0000");

  const colored = editable.locator("span[style*='color']").first();
  await expect(colored).toHaveCSS("color", "rgb(255, 0, 0)");
});

test("applies a highlight color to the selected text", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  await editable.click();
  await editable.selectText();
  await page.waitForTimeout(50);
  await page.getByLabel("Highlight color").fill("#00ff00");

  const marked = editable.locator("mark").first();
  await expect(marked).toHaveCSS("background-color", "rgb(0, 255, 0)");
});

test("carries the text color into HTML export", async ({ page }) => {
  await page.goto("/");
  const editable = page.locator(".playground-editor [contenteditable='true']");

  await editable.click();
  await editable.selectText();
  await page.waitForTimeout(50);
  await page.getByLabel("Text color").fill("#ff0000");

  await page.getByLabel("Serialization format").selectOption("html");
  await page.getByRole("button", { name: "Export", exact: true }).click();

  // The browser normalizes the style value to rgb() in the serialized markup.
  await expect(page.getByLabel("Serialized document")).toHaveValue(/color:\s*rgb\(255, 0, 0\)/i);
});
