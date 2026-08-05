import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * Find and replace in a real browser (ROADMAP Phase 8).
 *
 * Only a browser can prove the parts that matter here: that Ctrl/Cmd+F reaches
 * us rather than the browser's own find, and that matches are actually painted
 * on the page.
 */

const EDITOR = ".de-editor";

test.use({ viewport: { width: 1440, height: 900 } });

async function openFind(page: Page) {
  await page.locator(EDITOR).locator("[contenteditable='true']").locator("p").first().click();
  await page.keyboard.press("Control+f");
  await expect(page.getByRole("search", { name: "Find and replace" })).toBeVisible();
  return page.getByRole("textbox", { name: "Find" });
}

test("Ctrl+F opens the bar rather than the browser's find", async ({ page }) => {
  await page.goto("/");
  // Closed until asked for — it floats over the document rather than occupying
  // a permanent panel.
  await expect(page.getByRole("search", { name: "Find and replace" })).toHaveCount(0);

  await openFind(page);
});

test("paints every match, and marks the current one differently", async ({ page }) => {
  await page.goto("/");
  const find = await openFind(page);
  await find.fill("Docs");

  const matches = page.locator(EDITOR).locator(".docs-editor-search-match");
  await expect(matches).toHaveCount(2);
  await expect(page.locator(".docs-editor-search-match-active")).toHaveCount(1);

  // Distinct backgrounds: "next" that moves the selection with no visible
  // change is indistinguishable from a broken button.
  // Read from the *second* match: the first one is the current one, so reading
  // it would compare the active colour with itself.
  const [other, active] = await Promise.all([
    matches.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor),
    page
      .locator(".docs-editor-search-match-active")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ]);
  expect(other).not.toBe(active);
});

test("steps through matches and wraps", async ({ page }) => {
  await page.goto("/");
  const find = await openFind(page);
  await find.fill("Docs");
  await expect(page.locator(".de-find-bar__status")).toHaveText("1 of 2");

  await page.getByRole("button", { name: "Next match" }).click();
  await expect(page.locator(".de-find-bar__status")).toHaveText("2 of 2");

  await page.getByRole("button", { name: "Next match" }).click();
  await expect(page.locator(".de-find-bar__status")).toHaveText("1 of 2");
});

test("opens as plain find, with replace behind the overflow button", async ({ page }) => {
  await page.goto("/");
  await openFind(page);

  await expect(page.getByRole("textbox", { name: "Replace with" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show replace" }).click();
  await expect(page.getByRole("textbox", { name: "Replace with" })).toBeVisible();
});

test("replaces every match", async ({ page }) => {
  await page.goto("/");
  const find = await openFind(page);
  await find.fill("Docs");

  await page.getByRole("button", { name: "Show replace" }).click();
  await page.getByRole("textbox", { name: "Replace with" }).fill("Papers");
  await page.getByRole("button", { name: "All" }).click();

  await expect(page.locator(EDITOR)).toContainText("Papers Editor");
  await expect(page.locator(".de-find-bar__status")).toHaveText("0 of 0");
});

test("closes on Escape", async ({ page }) => {
  await page.goto("/");
  await openFind(page);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("search", { name: "Find and replace" })).toHaveCount(0);
});
