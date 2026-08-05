import { expect, test } from "@playwright/test";

import { chooseOption } from "./select";

import type { Page } from "@playwright/test";

/**
 * Editing in a real browser (ROADMAP Phase 8, Milestone 8.6).
 *
 * This suite covers what **only** a browser can prove: `contenteditable`
 * behaviour, real layout, native selection, and the toolbar actually reaching
 * the document. Component behaviour — a button's pressed state, a menu opening,
 * a dialog trapping focus — is unit-tested in `@sbh321/docs-editor`, and
 * re-asserting it here would only make the suite slower without making it
 * stronger.
 */

const EDITOR = ".de-editor";

// Wide enough that the whole toolbar fits. At a narrower width its controls
// legitimately move into the overflow menu — that is its own test.
test.use({ viewport: { width: 1800, height: 900 } });

/** The main toolbar, so a control is never confused with the floating one. */
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Formatting" });

async function editable(page: Page) {
  const element = page.locator(EDITOR).locator("[contenteditable='true']");
  // Into the *paragraph*, not the heading. The document opens with both, and a
  // heading cannot be wrapped in a list under the default schema: `list_item`
  // requires a paragraph first, so `wrapInList` correctly reports itself
  // unavailable there.
  await element.locator("p").first().click();
  // The click returns before the editor holds focus and a caret, and under
  // parallel-worker load a key sent into that gap goes to the page instead of
  // the keymap — a Ctrl+B that silently bolds nothing. Waiting for both closes
  // the gap for every test in this file.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.activeElement;
        const selection = window.getSelection();
        return (
          active?.getAttribute("contenteditable") === "true" &&
          selection !== null &&
          selection.anchorNode !== null &&
          active.contains(selection.anchorNode)
        );
      }),
    )
    .toBe(true);
  return element;
}

test("boots and renders the document", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
  await expect(page.locator(EDITOR)).toContainText("Hello, Docs Editor.");
});

test("typing reaches the document", async ({ page }) => {
  await page.goto("/");
  const element = await editable(page);

  await page.keyboard.type("Typed. ");
  await expect(element).toContainText("Typed.");
});

test("Enter splits a paragraph and Backspace joins it back", async ({ page }) => {
  await page.goto("/");
  const element = await editable(page);

  const before = await element.locator("p").count();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second");
  await expect(element.locator("p")).toHaveCount(before + 1);

  // Backspace at the start of a block joins it to the previous one — the
  // baseKeymap behaviour that only real key handling exercises.
  //
  // The pause lets the split settle first. Without it, under parallel load the
  // caret move can land mid-transaction, `Home` never reaches the start, and
  // Backspace deletes a character instead of joining.
  await page.waitForTimeout(100);
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");
  await expect(element.locator("p")).toHaveCount(before);
});

test("keyboard shortcuts run their bound commands", async ({ page }) => {
  await page.goto("/");
  const element = await editable(page);

  await page.keyboard.press("End");
  await page.keyboard.down("ControlOrMeta");
  await page.keyboard.press("b");
  await page.keyboard.up("ControlOrMeta");
  await page.keyboard.type("bold");
  await expect(element.locator("strong")).toHaveText("bold");

  await page.keyboard.down("ControlOrMeta");
  await page.keyboard.press("z");
  await page.keyboard.up("ControlOrMeta");
  await expect(element.locator("strong")).toHaveCount(0);
});

test("the toolbar's formatting reaches the document", async ({ page }) => {
  await page.goto("/");
  const element = await editable(page);
  await element.selectText();

  // Scoped: selecting text also raises the floating toolbar, which carries its
  // own Bold — two matching buttons is correct, so the test must say which.
  await toolbar(page).getByLabel("Bold").click();
  await expect(element.locator("strong")).not.toHaveCount(0);
});

test("the block-type select changes the block in place", async ({ page }) => {
  await page.goto("/");
  const element = await editable(page);

  await chooseOption(page, "Block type", "Heading 2");
  await expect(element.locator("h2")).toHaveCount(1);
});

test("a list is created and edited with Enter and Tab", async ({ page }) => {
  await page.goto("/");
  const element = await editable(page);

  await toolbar(page).getByLabel("Bullet list").click();
  await expect(element.locator("ul li")).toHaveCount(1);

  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second item");
  await expect(element.locator("ul li")).toHaveCount(2);

  // Tab sinks a list item rather than moving focus — only real key handling
  // shows whether that binding wins over the browser's default.
  await page.keyboard.press("Tab");
  await expect(element.locator("ul ul li")).toHaveCount(1);
});

test("a table is inserted and edited through the contextual controls", async ({ page }) => {
  await page.goto("/");
  await editable(page);

  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByRole("menuitem", { name: "Table" }).click();

  const element = page.locator(EDITOR);
  await expect(element.locator("table")).toHaveCount(1);
  await expect(element.locator("tr")).toHaveCount(3);

  // The table controls appear only with the cursor inside a table, so their
  // presence is itself the assertion that the contextual logic works.
  await element.locator("td").first().click();
  await page.getByRole("button", { name: "Add row" }).click();
  await expect(element.locator("tr")).toHaveCount(4);
});

test("text and highlight colours apply as inline styles", async ({ page }) => {
  await page.goto("/");
  const element = await editable(page);
  await element.selectText();
  await page.waitForTimeout(50);

  await page.getByLabel("Text colour").fill("#ff0000");
  await expect(element.locator("span[style*='color']").first()).toHaveCSS(
    "color",
    "rgb(255, 0, 0)",
  );
});

test("the font select applies a family", async ({ page }) => {
  await page.goto("/");
  const element = await editable(page);
  await element.selectText();
  await page.waitForTimeout(50);

  await chooseOption(page, "Font", "Georgia");
  await expect(element.locator("span[style*='font-family']").first()).toHaveCSS(
    "font-family",
    /Georgia/,
  );
});
