import { expect, test } from "@playwright/test";

// Phase 4 (User Interface) coverage: the headless UI components wired into the
// playground. These exercise the parts unit tests can't — real selection
// geometry (floating toolbar, slash menu positioning), pointer events (context
// menu), and live active-state reflection against a rendered contentEditable.

test("toolbar buttons reflect active mark and block state", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  const bold = page.getByRole("button", { name: "Toggle bold" });
  await expect(bold).toHaveAttribute("aria-pressed", "false");

  await editable.click();
  await editable.selectText();
  await bold.click();

  await expect(editor.locator("strong")).toHaveText("Hello, Docs Editor.");
  await expect(bold).toHaveAttribute("aria-pressed", "true");

  // Block-style buttons reflect the active block type, too.
  const heading1 = page.getByRole("button", { name: "Heading 1" });
  await expect(heading1).toHaveAttribute("aria-pressed", "false");
  await heading1.click();
  await expect(heading1).toHaveAttribute("aria-pressed", "true");
  await expect(editor.locator("h1")).toHaveCount(1);

  await page.getByRole("button", { name: "Paragraph" }).click();
  await expect(heading1).toHaveAttribute("aria-pressed", "false");
});

test("floating toolbar appears over a selection and formats it", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  // No floating toolbar while the selection is collapsed.
  await expect(page.getByRole("button", { name: "Bold (floating)" })).toHaveCount(0);

  await editable.click();
  await editable.selectText();

  const floatingBold = page.getByRole("button", { name: "Bold (floating)" });
  await expect(floatingBold).toBeVisible();
  await floatingBold.click();
  await expect(editor.locator("strong")).toHaveText("Hello, Docs Editor.");
});

test("slash menu opens on '/', filters, and runs a command (removing the query)", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");
  const editable = editor.locator("[contenteditable='true']");

  await editable.click();
  await page.keyboard.press("End");
  await page.waitForTimeout(50);
  // The menu only opens when "/" starts a word (block start or after
  // whitespace), so type a space first, then the trigger + a filter query.
  await page.keyboard.type(" /quote");

  const menu = page.getByRole("listbox", { name: "Slash commands" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("option", { name: /Quote/ })).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(editor.locator("blockquote")).toHaveCount(1);
  // The typed "/quote" is gone — it isn't left behind as literal text.
  await expect(editable).not.toContainText("/quote");
});

test("right-click opens a context menu that closes on Escape", async ({ page }) => {
  await page.goto("/");
  const editable = page.locator(".playground-editor [contenteditable='true']");

  await editable.click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Bold" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("outline panel lists headings and navigation is wired", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  // No headings yet, so the outline is empty.
  const outline = page.locator(".pg-outline");
  await expect(outline.getByRole("button")).toHaveCount(0);

  // Turn the paragraph into a heading; the outline should pick it up.
  await editor.locator("[contenteditable='true']").click();
  await page.getByRole("button", { name: "Heading 1" }).click();

  await expect(outline.getByRole("button", { name: "Hello, Docs Editor." })).toBeVisible();
  // Clicking navigates without error (selection moves into the heading).
  await outline.getByRole("button", { name: "Hello, Docs Editor." }).click();
  await expect(editor.locator("h1")).toHaveText("Hello, Docs Editor.");
});

test("search highlighting paints matches via the decoration layer", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  // "Docs" is the default Find query and the initial document contains it once,
  // so a highlight appears on load — without editing the document.
  await expect(editor.locator(".docs-editor-search-match")).toHaveCount(1);
  await expect(editor.locator(".docs-editor-search-match")).toHaveText("Docs");

  // "Find next" selects that match, which then also gets the active class.
  await page.getByRole("button", { name: "Find next" }).click();
  await expect(editor.locator(".docs-editor-search-match-active")).toHaveCount(1);

  // Clearing the query removes every highlight.
  await page.getByLabel("Find").fill("");
  await expect(editor.locator(".docs-editor-search-match")).toHaveCount(0);
});

test("zoom controls scale the editor", async ({ page }) => {
  await page.goto("/");

  const reset = page.getByRole("button", { name: "Reset zoom" });
  await expect(reset).toHaveText("100%");

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(reset).toHaveText("110%");

  // The editor container carries the scale transform.
  const editor = page.locator(".playground-editor");
  await expect(editor).toHaveAttribute("style", /scale\(1\.1\)/);

  await reset.click();
  await expect(reset).toHaveText("100%");
});
