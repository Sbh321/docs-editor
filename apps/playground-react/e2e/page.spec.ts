import { expect, test } from "@playwright/test";

import { loadMarkdownDocument } from "./load-document";
import { toolbarControl } from "./toolbar";

import type { Page } from "@playwright/test";

/**
 * Page layout and pagination (ROADMAP Phase 8, Milestone 8.6).
 *
 * Pagination is measurement-driven: content flows onto a new sheet when it
 * exceeds the printable height of the current one. Nothing about that is
 * observable without real layout.
 */

const EDITOR = ".de-editor";

// Wide enough for the whole toolbar and the status bar's zoom controls.
test.use({ viewport: { width: 1800, height: 900 } });

/** Opens the layout panel, which holds the page-setup controls. */
async function openLayout(page: Page) {
  await (await toolbarControl(page, "Layout")).click();
  await expect(page.getByRole("complementary", { name: "Layout" })).toBeVisible();
}

test("renders the document on a page sheet inside a canvas", async ({ page }) => {
  await page.goto("/");

  const sheet = page.locator(".de-page, [data-page]").first();
  await expect(sheet).toBeVisible();

  const box = await sheet.boundingBox();
  // A4 at 96dpi is 794px wide; the page must look like paper rather than
  // filling the window.
  expect(box?.width).toBeGreaterThan(600);
  expect(box?.width).toBeLessThan(900);
});

test("changing the page size changes the sheet's width", async ({ page }) => {
  await page.goto("/");
  const sheet = page.locator(".de-page, [data-page]").first();
  const before = (await sheet.boundingBox())?.width ?? 0;

  await openLayout(page);
  await page.getByLabel("Page size").selectOption("Letter");
  await expect.poll(async () => (await sheet.boundingBox())?.width ?? 0).not.toBe(before);
});

test("landscape orientation swaps the sheet's proportions", async ({ page }) => {
  await page.goto("/");
  const sheet = page.locator(".de-page, [data-page]").first();
  const portrait = await sheet.boundingBox();

  await openLayout(page);
  await page.getByLabel("Page orientation").selectOption("landscape");
  await expect
    .poll(async () => (await sheet.boundingBox())?.width ?? 0)
    .toBeGreaterThan(portrait?.width ?? 0);
});

test("content flows onto additional sheets as it grows", async ({ page }) => {
  await page.goto("/");
  const editable = page.locator(EDITOR).locator("[contenteditable='true']");
  await editable.click();

  const sheets = page.locator(".de-page, [data-page]");
  const before = await sheets.count();

  // Enough content to exceed one printable page.
  await page.evaluate(() => {
    const element = document.querySelector(".de-editor [contenteditable='true']");
    if (element) {
      element.dispatchEvent(new Event("focus"));
    }
  });
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.type(`Paragraph ${String(index)} with enough text to take a full line. `);
    await page.keyboard.press("Enter");
  }

  await expect.poll(async () => sheets.count(), { timeout: 15_000 }).toBeGreaterThan(before);
});

test("zoom scales the page", async ({ page }) => {
  await page.goto("/");
  const sheet = page.locator(".de-page, [data-page]").first();
  const before = (await sheet.boundingBox())?.width ?? 0;

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => (await sheet.boundingBox())?.width ?? 0).toBeGreaterThan(before);
});

test("typing at a page boundary does not make the layout snap back and forth", async ({ page }) => {
  await page.goto("/");
  // Fill just past one page, so the boundary sits amid live content.
  await loadMarkdownDocument(
    page,
    Array.from(
      { length: 45 },
      (_, index) => `Paragraph ${index + 1} of the boundary test with enough words to wrap once.`,
    ).join("\n\n"),
  );
  await expect
    .poll(async () => page.locator(".de-page").count(), { timeout: 15_000 })
    .toBeGreaterThan(1);
  await page.waitForTimeout(500);

  // Type at the very end — right where content crosses onto the next sheet.
  const editable = page.locator("[contenteditable='true']");
  await editable.locator("> *").last().click();
  await page.keyboard.press("Control+End");

  // Sample the layout while typing. The regression (Phase 9.14) showed up as
  // the page-break spacing flickering off and on with every keystroke and the
  // break flip-flopping between blocks, so the samples oscillated: the total
  // height went down, up, down. A settled layout only ever grows here.
  const samples: number[] = [];
  for (let burst = 0; burst < 8; burst += 1) {
    await page.keyboard.type("more words being typed at the boundary ", { delay: 5 });
    await page.waitForTimeout(220); // past the repagination idle window
    samples.push(await editable.evaluate((node) => node.scrollHeight));
  }

  let reversals = 0;
  for (let index = 2; index < samples.length; index += 1) {
    const previous = Math.sign(samples[index - 1]! - samples[index - 2]!);
    const current = Math.sign(samples[index]! - samples[index - 1]!);
    if (previous !== 0 && current !== 0 && current !== previous) {
      reversals += 1;
    }
  }
  // Adding text must only ever grow the laid-out height once each pass has
  // settled. One reversal is tolerated for a break legitimately re-seating;
  // the pre-fix behaviour produced several.
  expect(reversals).toBeLessThanOrEqual(1);

  // And the count itself must not have collapsed back.
  expect(await page.locator(".de-page").count()).toBeGreaterThan(1);
});
