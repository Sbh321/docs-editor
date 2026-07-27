import { expect, test } from "@playwright/test";

test("playground boots and resolves the docs-editor-react package", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Docs Editor Playground" })).toBeVisible();
  await expect(page.locator(".document-preview").getByText("Hello, Docs Editor.")).toBeVisible();
});

test("dispatching a transaction re-renders the document preview", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: 'Insert "Hi! "' }).click();
  await expect(
    page.locator(".document-preview").getByText("Hi! Hello, Docs Editor."),
  ).toBeVisible();
});

test("undo/redo revert and restore a dispatched edit", async ({ page }) => {
  await page.goto("/");
  const preview = page.locator(".document-preview");

  await page.getByRole("button", { name: 'Insert "Hi! "' }).click();
  await expect(preview.getByText("Hi! Hello, Docs Editor.")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(preview.getByText("Hello, Docs Editor.")).toBeVisible();
  await expect(preview.getByText("Hi! Hello, Docs Editor.")).toHaveCount(0);

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(preview.getByText("Hi! Hello, Docs Editor.")).toBeVisible();
});

test("typing directly into the rendered editor updates the document", async ({ page }) => {
  await page.goto("/");

  const editable = page.locator(".playground-editor [contenteditable='true']");
  await editable.click();
  // Short waits after real key events: ProseMirror learns of the new selection
  // asynchronously (via selectionchange), so acting immediately can race it —
  // see the fuller note on the list-editing test below.
  await page.waitForTimeout(50);
  await page.keyboard.press("Home");
  await page.waitForTimeout(50);
  await page.keyboard.type("Typed! ");

  await expect(editable).toContainText("Typed! Hello, Docs Editor.");
  await expect(
    page.locator(".document-preview").getByText("Typed! Hello, Docs Editor."),
  ).toBeVisible();
});

test("nodeRenderers/markRenderers render real semantic tags, not the generic default", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await expect(editor.locator("p")).toHaveCount(1);
  await expect(editor.locator("paragraph")).toHaveCount(0);

  await page.getByRole("button", { name: "Toggle bold" }).click();
  await page.getByRole("button", { name: 'Insert "Hi! "' }).click();

  const strong = editor.locator("strong");
  await expect(strong).toHaveCount(1);
  await expect(strong).toHaveCSS("font-weight", "700");
});

test("setBlockType changes a paragraph into a heading and back, in place", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await page.getByRole("button", { name: "Heading 1" }).click();
  const h1 = editor.locator("h1");
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Hello, Docs Editor.");

  await page.getByRole("button", { name: "Heading 2" }).click();
  await expect(editor.locator("h1")).toHaveCount(0);
  await expect(editor.locator("h2")).toHaveText("Hello, Docs Editor.");

  await page.getByRole("button", { name: "Paragraph" }).click();
  await expect(editor.locator("h2")).toHaveCount(0);
  await expect(editor.locator("p")).toHaveText("Hello, Docs Editor.");
});

test("wrapIn/lift wrap a paragraph in a blockquote and back", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await page.getByRole("button", { name: "Quote", exact: true }).click();
  const quote = editor.locator("blockquote");
  await expect(quote).toHaveCount(1);
  await expect(quote.locator("p")).toHaveText("Hello, Docs Editor.");

  await page.getByRole("button", { name: "Un-quote" }).click();
  await expect(editor.locator("blockquote")).toHaveCount(0);
  await expect(editor.locator("p")).toHaveText("Hello, Docs Editor.");
});

test("toggleMark applies an attribute-carrying link mark, rendered as a real <a href>", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  const editable = editor.locator("[contenteditable='true']");
  await editable.click();
  // selectText() sets the DOM selection directly rather than racing a native
  // Ctrl+A against ProseMirror's async selectionchange handling — see the
  // "keyboard shortcuts" test above for the full explanation.
  await editable.selectText();

  await page.getByLabel("Link href").fill("https://docs-editor.example/");
  await page.getByRole("button", { name: "Toggle link" }).click();

  const link = editor.locator("a");
  await expect(link).toHaveAttribute("href", "https://docs-editor.example/");
  await expect(link).toHaveText("Hello, Docs Editor.");

  // Toggling again over the same (still-selected) range removes it.
  await page.getByRole("button", { name: "Toggle link" }).click();
  await expect(editor.locator("a")).toHaveCount(0);
});

test("keyboard shortcuts (Mod-b, Mod-z, Shift-Mod-z) run their bound commands", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  async function pressCombo(key: string) {
    await page.keyboard.down("ControlOrMeta");
    await page.keyboard.press(key);
    await page.keyboard.up("ControlOrMeta");
  }

  await editable.click();
  // selectText() sets the DOM selection directly rather than simulating a
  // native Ctrl+A keydown — a real Ctrl+A races with an immediately-following
  // shortcut, since the browser's selectionchange event (which ProseMirror
  // relies on to notice the new selection) doesn't always land before the
  // next keydown fires. Real users don't hit this because they aren't
  // scripted to press two shortcuts back-to-back with zero delay.
  await editable.selectText();
  await pressCombo("b");

  const strong = editor.locator("strong");
  await expect(strong).toHaveCount(1);
  await expect(strong).toHaveText("Hello, Docs Editor.");

  await pressCombo("z");
  await expect(editor.locator("strong")).toHaveCount(0);

  await page.keyboard.down("ControlOrMeta");
  await page.keyboard.down("Shift");
  await page.keyboard.press("z");
  await page.keyboard.up("Shift");
  await page.keyboard.up("ControlOrMeta");
  await expect(editor.locator("strong")).toHaveText("Hello, Docs Editor.");
});

test("wrapInList wraps a paragraph in a real <ul>/<li>, and Enter/Tab/Shift-Tab edit the list", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await page.getByRole("button", { name: "Bullet list" }).click();
  await expect(editor.locator("ul > li > p")).toHaveText("Hello, Docs Editor.");

  // Scoped to the contenteditable's *direct* <ul> child so a later nested
  // sub-list (from Tab) isn't also counted — "ul > li" alone would match
  // both the top-level item and the nested one once it exists.
  const topLevelItems = editor.locator("[contenteditable='true'] > ul > li");

  // Click directly on the paragraph text (not the outer editor container) so
  // the caret lands inside it, then move to its end before splitting. A
  // short wait follows each real (native) key event: the browser's own
  // selection updates synchronously, but ProseMirror's view learns about it
  // asynchronously (via `selectionchange`), so firing the next key
  // immediately can act on ProseMirror's still-stale selection — verified by
  // reproducing this racing 3/8 times without the waits, and 0/8 times with
  // them. Not a docs-editor bug: real typing has natural gaps between
  // keystrokes that a script doesn't.
  const paragraph = editor.locator("li p").first();
  await paragraph.click();
  await page.waitForTimeout(50);
  await page.keyboard.press("End");
  await page.waitForTimeout(50);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  await page.keyboard.type("Second item");

  await expect(topLevelItems).toHaveCount(2);
  await expect(topLevelItems.nth(0)).toHaveText("Hello, Docs Editor.");
  await expect(topLevelItems.nth(1)).toHaveText("Second item");

  // Tab sinks the second item into a nested list under the first.
  await page.waitForTimeout(50);
  await page.keyboard.press("Tab");
  await expect(topLevelItems).toHaveCount(1);
  await expect(editor.locator("ul > li ul > li")).toHaveText("Second item");

  // Shift-Tab lifts it back out to the top level.
  await page.waitForTimeout(50);
  await page.keyboard.press("Shift+Tab");
  await expect(topLevelItems).toHaveCount(2);
  await expect(editor.locator("ul > li ul")).toHaveCount(0);
});

test("Transaction.insertNode() inserts a real, non-editable <hr> leaf node", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await page.getByRole("button", { name: "Insert divider" }).click();

  const divider = editor.locator("hr");
  await expect(divider).toHaveCount(1);
  // A leaf node with no `content` at all — ProseMirror renders it as a
  // single, non-editable unit, not something the cursor can enter.
  await expect(divider).toHaveAttribute("contenteditable", "false");
});

test("code_block's Enter inserts a newline instead of splitting, and Mod-Enter exits it", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await page.getByRole("button", { name: "Code block" }).click();
  const code = editor.locator("pre code");
  await expect(code).toHaveCount(1);

  await code.click();
  await page.keyboard.press("End");
  await page.waitForTimeout(50);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  await page.keyboard.type("line2");

  // Still one code block, now with an embedded newline — not two paragraphs.
  await expect(editor.locator("pre")).toHaveCount(1);
  await expect(code).toHaveText("Hello, Docs Editor.\nline2");

  await page.waitForTimeout(50);
  await page.keyboard.down("ControlOrMeta");
  await page.keyboard.press("Enter");
  await page.keyboard.up("ControlOrMeta");

  // exitCode created a real paragraph after the code block.
  await expect(editor.locator("pre + p")).toHaveCount(1);
});

test("Insert image / Insert figure create real leaf/figure elements via insertNode()", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await page.getByRole("button", { name: "Insert image" }).click();
  const image = editor.locator("img").first();
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute("src", "https://placekitten.com/200/120");
  await expect(image).toHaveAttribute("contenteditable", "false");

  await page.getByRole("button", { name: "Insert figure" }).click();
  const figure = editor.locator("figure");
  await expect(figure).toHaveCount(1);
  await expect(figure.locator("img")).toHaveAttribute("src", "https://placekitten.com/200/120");
  await expect(figure.locator("figcaption")).toHaveText("A caption.");
});

test("Find next cycles findText() matches, and Replace acts on the current one via insertText()", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  await editable.click();
  await editable.selectText();
  await page.keyboard.type("Docs one Docs two Docs three");

  // The "Find" input already defaults to "Docs" and "Replace with" to
  // "Replaced" — three occurrences exist. Each "Find next" click advances to
  // the next match (wrapping around), and "Replace" replaces whichever match
  // is currently selected — there's no dedicated replace primitive, it's
  // just `insertText` over that match's range.
  await page.getByRole("button", { name: "Find next" }).click();
  await page.getByRole("button", { name: "Replace" }).click();
  await expect(editable).toHaveText("Replaced one Docs two Docs three");

  await page.getByRole("button", { name: "Find next" }).click();
  await page.getByRole("button", { name: "Find next" }).click();
  await page.getByRole("button", { name: "Replace" }).click();
  await expect(editable).toHaveText("Replaced one Docs two Replaced three");
});

test("tables: insert, cursor-based row/column ops, drag-select + merge, and delete", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  // Insert a 2x2 table via insertNode() (no bespoke command).
  await page.getByRole("button", { name: "Insert table" }).click();
  await expect(editor.locator("table")).toHaveCount(1);
  await expect(editor.locator("table tr")).toHaveCount(2);
  await expect(editor.locator("table td")).toHaveCount(4);

  // Cursor-based commands: click into a cell, then add a row and a column.
  // A short wait after the real click, per the selection-propagation note on
  // the list test above — ProseMirror learns of the new selection async.
  await editor.locator("table td").first().click();
  await page.waitForTimeout(50);
  await page.getByRole("button", { name: "Add row" }).click();
  await expect(editor.locator("table tr")).toHaveCount(3);
  await page.getByRole("button", { name: "Add column" }).click();
  await expect(editor.locator("table td")).toHaveCount(9);

  // Drag across the first row's two cells to make a rectangular CellSelection
  // (the new Selection type, produced by the table-editing plugin), then
  // merge them into one cell spanning two columns.
  const cellA = editor.locator("table td").nth(0);
  const cellB = editor.locator("table td").nth(1);
  const a = await cellA.boundingBox();
  const b = await cellB.boundingBox();
  if (!a || !b) throw new Error("Expected both cells to be laid out.");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  // The plugin marks selected cells with a `selectedCell` class.
  await expect(editor.locator("td.selectedCell")).toHaveCount(2);

  await page.getByRole("button", { name: "Merge cells" }).click();
  await expect(editor.locator("table td")).toHaveCount(8);
  await expect(editor.locator("table td").first()).toHaveAttribute("colspan", "2");

  // Delete the whole table from a cursor inside it.
  await editor.locator("table td").first().click();
  await page.waitForTimeout(50);
  await page.getByRole("button", { name: "Delete table" }).click();
  await expect(editor.locator("table")).toHaveCount(0);
});
