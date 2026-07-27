import { expect, test } from "@playwright/test";

// Font family toolbar: `setMark("font_family", …)` applies a font over the
// selection (or as a stored mark at the cursor). Arial is the default.

test("defaults to Arial", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Font family")).toHaveValue("Arial, Helvetica, sans-serif");
});

test("applies a chosen font to the selected text as a styled span", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  await editable.click();
  // selectText sets the DOM selection directly; the short wait lets ProseMirror
  // observe it before the command runs (see the note in playground.spec.ts).
  await editable.selectText();
  await page.waitForTimeout(50);

  await page.getByLabel("Font family").selectOption({ label: "Georgia" });

  const span = editor.locator("span[style*='Georgia']");
  await expect(span).toContainText("Hello, Docs Editor.");
});

test("carries the chosen font into newly typed text (stored mark)", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  await editable.click();
  await page.keyboard.press("End");
  await page.waitForTimeout(50);
  await page.getByLabel("Font family").selectOption({ label: "Verdana" });
  await page.waitForTimeout(50);
  await page.keyboard.type("Vee");

  await expect(editor.locator("span[style*='Verdana']")).toContainText("Vee");
});
