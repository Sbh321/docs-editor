import { expect, test } from "@playwright/test";

// Phase 4.5 (Polish & Foundation Gaps): the essential editing keymap. Before
// this, Enter in a paragraph did nothing and Backspace couldn't join blocks —
// the editor wasn't usable as a plain text editor out of the box. `baseKeymap`
// fixes that; these drive the real keys against the rendered contentEditable.

test("Enter splits a paragraph and Backspace joins it back (baseKeymap)", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  await expect(editor.locator("p")).toHaveCount(1);

  await editable.click();
  await page.keyboard.press("End");
  await page.waitForTimeout(50);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  await page.keyboard.type("Second");

  // Enter split the paragraph into two — not a newline inside one.
  await expect(editor.locator("p")).toHaveCount(2);
  await expect(editor.locator("p").nth(0)).toHaveText("Hello, Docs Editor.");
  await expect(editor.locator("p").nth(1)).toHaveText("Second");

  // Backspace at the start of the second paragraph joins it back into the first.
  await page.keyboard.press("Home");
  await page.waitForTimeout(50);
  await page.keyboard.press("Backspace");

  await expect(editor.locator("p")).toHaveCount(1);
  await expect(editor.locator("p")).toHaveText("Hello, Docs Editor.Second");
});

test("clicking an atomic node selects it as a unit and Backspace deletes it", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await editor.locator("[contenteditable='true']").click();
  await page.getByRole("button", { name: "Insert divider" }).click();
  const divider = editor.locator("hr");
  await expect(divider).toHaveCount(1);

  // Clicking a leaf node selects the whole node (a NodeSelection, round-tripped
  // through docs-editor's Selection as type "node"); ProseMirror marks the
  // selected node's DOM with a class.
  await divider.click();
  await page.waitForTimeout(50);
  await expect(editor.locator("hr.ProseMirror-selectednode")).toHaveCount(1);

  // Backspace (baseKeymap) deletes the selected node.
  await page.keyboard.press("Backspace");
  await expect(editor.locator("hr")).toHaveCount(0);
});

test("formatting marks apply and Clear formatting removes them all", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  await editable.click();
  await editable.selectText();

  await page.getByRole("button", { name: "Toggle italic" }).click();
  await expect(editor.locator("em")).toHaveText("Hello, Docs Editor.");
  await page.getByRole("button", { name: "Toggle underline" }).click();
  await expect(editor.locator("u")).toHaveCount(1);

  // The italic button reflects active state now.
  await expect(page.getByRole("button", { name: "Toggle italic" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Clear formatting (removeFormatting) strips every mark from the selection.
  await page.getByRole("button", { name: "Clear formatting" }).click();
  await expect(editor.locator("em")).toHaveCount(0);
  await expect(editor.locator("u")).toHaveCount(0);
});
