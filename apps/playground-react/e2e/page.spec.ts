import { expect, test } from "@playwright/test";

// Page layout: the editor renders inside a sized "page" surface with page-setup
// controls (size / orientation / margins / page numbers) and header/footer.

test("renders the editor inside a page surface", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".pg-page").first()).toBeVisible();
  await expect(page.locator(".playground-editor")).toContainText("Hello, Docs Editor.");
});

test("changing the page size resizes the sheet", async ({ page }) => {
  await page.goto("/");
  const sheet = page.locator(".pg-page");

  const a4Width = (await sheet.boundingBox())?.width ?? 0;
  expect(a4Width).toBeGreaterThan(0);

  await page.getByLabel("Page size").selectOption("A5");
  // A5 is narrower than A4; the sheet must shrink.
  await expect(async () => {
    const a5Width = (await sheet.boundingBox())?.width ?? 0;
    expect(a5Width).toBeLessThan(a4Width);
  }).toPass();
});

test("landscape orientation makes the sheet wider than tall relative to portrait", async ({
  page,
}) => {
  await page.goto("/");
  const sheet = page.locator(".pg-page");
  const portrait = await sheet.boundingBox();

  await page.getByLabel("Page orientation").selectOption("landscape");
  await expect(async () => {
    const landscape = await sheet.boundingBox();
    expect((landscape?.width ?? 0) > (portrait?.width ?? 0)).toBe(true);
  }).toPass();
});

test("live pagination splits long content across multiple sheets and reflows", async ({ page }) => {
  await page.goto("/");

  // Import a long document (many paragraphs) so it exceeds one page.
  const longDoc = Array.from(
    { length: 90 },
    (_, i) => `Paragraph number ${i + 1} with enough text to occupy a full line on the page.`,
  ).join("\n\n");
  await page.getByLabel("Serialization format").selectOption("markdown");
  await page.getByLabel("Serialized document").fill(longDoc);
  await page.getByRole("button", { name: "Import", exact: true }).click();

  // Multiple page sheets are drawn.
  await expect(async () => {
    expect(await page.locator(".pg-page").count()).toBeGreaterThan(1);
  }).toPass({ timeout: 5000 });

  // At least one block carries page-break spacing (a node-decoration margin).
  await expect(async () => {
    const withMargin = await page
      .locator(".playground-editor [contenteditable='true'] > [style*='margin-top']")
      .count();
    expect(withMargin).toBeGreaterThan(0);
  }).toPass({ timeout: 5000 });
});

test("toggling live pagination off returns to a single sheet", async ({ page }) => {
  await page.goto("/");

  const longDoc = Array.from(
    { length: 90 },
    (_, i) => `Paragraph number ${i + 1} with enough text to occupy a full line on the page.`,
  ).join("\n\n");
  await page.getByLabel("Serialization format").selectOption("markdown");
  await page.getByLabel("Serialized document").fill(longDoc);
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(async () => {
    expect(await page.locator(".pg-page").count()).toBeGreaterThan(1);
  }).toPass({ timeout: 5000 });

  await page.getByLabel("Live pagination").uncheck();
  await expect(page.locator(".pg-page")).toHaveCount(1);
});

test("header, footer, and page numbers appear on the page", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Page header").fill("Quarterly Report");
  await expect(page.locator(".pg-page-header")).toHaveText("Quarterly Report");

  await page.getByLabel("Page footer").fill("Confidential");
  await page.getByLabel("Show page numbers").check();
  await expect(page.locator(".pg-page-footer")).toContainText("Confidential");
  await expect(page.locator(".pg-page-footer")).toContainText("Page 1");
});
