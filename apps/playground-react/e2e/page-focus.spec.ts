import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * The whole page behaves as the input (ROADMAP Phase 8).
 *
 * Paper does not have a small live area surrounded by dead space, and neither
 * does any document editor. These need a real browser: they are entirely about
 * hit-testing and layout, which jsdom does not do.
 */

const EDITOR = ".de-editor";

test.use({ viewport: { width: 1440, height: 950 } });

/** Focuses the editor, then reports what has focus after clicking a point. */
async function focusAfterClickingAt(page: Page, x: number, y: number) {
  await page.locator(EDITOR).locator("[contenteditable='true']").locator("p").first().click();
  await page.mouse.click(x, y);
  await page.waitForTimeout(120);
  return page.evaluate(() => document.activeElement?.getAttribute("contenteditable") ?? "none");
}

test("the editable fills the page's text column", async ({ page }) => {
  await page.goto("/");

  const page1 = await page.locator(".de-page").first().boundingBox();
  const editable = await page.locator(EDITOR).locator("[contenteditable='true']").boundingBox();

  // Not merely as tall as its text: a two-line document must still accept a
  // click three quarters of the way down the page.
  expect(editable?.height).toBeGreaterThan((page1?.height ?? 0) * 0.7);
});

test("clicking empty space below the text keeps the caret", async ({ page }) => {
  await page.goto("/");
  const box = await page.locator(".de-page").first().boundingBox();

  // The reported bug: clicking where the text has not reached dropped focus and
  // kicked the user out of editing.
  expect(await focusAfterClickingAt(page, (box?.x ?? 0) + 300, (box?.y ?? 0) + 600)).toBe("true");
});

test("clicking the page margins keeps the caret", async ({ page }) => {
  await page.goto("/");
  const box = await page.locator(".de-page").first().boundingBox();
  const x = box?.x ?? 0;
  const y = box?.y ?? 0;

  expect(await focusAfterClickingAt(page, x + 30, y + 300)).toBe("true");
  expect(await focusAfterClickingAt(page, x + 300, y + 30)).toBe("true");
});

test("clicking the canvas beside the page keeps the caret", async ({ page }) => {
  await page.goto("/");
  const box = await page.locator(".de-page").first().boundingBox();

  expect(await focusAfterClickingAt(page, (box?.x ?? 0) - 60, (box?.y ?? 0) + 300)).toBe("true");
});

test("controls outside the page still take focus normally", async ({ page }) => {
  await page.goto("/");
  await page.locator(EDITOR).locator("[contenteditable='true']").locator("p").first().click();

  // The page keeps focus, but it must not trap it — a toolbar field has to
  // remain usable.
  // A listbox since Phase 9, so the focused element is the combobox *button*
  // rather than a native `<select>`.
  await page.getByRole("combobox", { name: "Block type" }).click();
  expect(await page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("combobox");
});
