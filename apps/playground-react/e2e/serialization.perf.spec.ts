import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * Serialization latency in a real browser (ROADMAP Phase 6, Milestone 6.7).
 *
 * The core micro-benchmarks run under jsdom, whose DOM implementation is far
 * slower than a browser's — so they overstate anything that touches the DOM
 * (HTML export and, especially, import). They are also too noisy at the largest
 * scale to compare runs: 10 samples at ~25% RME.
 *
 * ARCHITECTURE's Import/Export Scalability section asks whether large documents
 * block the main editing experience, and that question is about a browser. These
 * measure the user-visible latency of each format end to end, which is what
 * decides whether chunked/streaming execution is warranted.
 */

const PARAGRAPHS = 1000;

async function loadLargeDocument(page: Page) {
  const markdown = Array.from(
    { length: PARAGRAPHS },
    (_, index) => `Paragraph ${index + 1} of the benchmark document with enough words to wrap.`,
  ).join("\n\n");
  await page.getByLabel("Serialization format").selectOption("markdown");
  await page.getByLabel("Serialized document").fill(markdown);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.waitForTimeout(2000);
}

/** Times an export: click through to the serialized text appearing. */
async function timeExport(page: Page, format: string): Promise<{ ms: number; chars: number }> {
  await page.getByLabel("Serialization format").selectOption(format);
  const io = page.getByLabel("Serialized document");
  await io.fill("");

  const started = Date.now();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(io).not.toHaveValue("");
  const ms = Date.now() - started;

  return { ms, chars: (await io.inputValue()).length };
}

/** Times an import of whatever is currently in the textarea. */
async function timeImport(page: Page): Promise<number> {
  const started = Date.now();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator(".playground-editor")).toContainText("Paragraph 1");
  return Date.now() - started;
}

for (const format of ["json", "html", "markdown"] as const) {
  test(`${format}: export and import a ${PARAGRAPHS}-paragraph document`, async ({ page }) => {
    await page.goto("/");
    await loadLargeDocument(page);

    const exported = await timeExport(page, format);
    const importMs = await timeImport(page);

    console.log(
      `[serialize] ${format.padEnd(8)} export ${String(exported.ms).padStart(5)} ms ` +
        `(${(exported.chars / 1024).toFixed(0)} KB)   import ${String(importMs).padStart(5)} ms`,
    );

    // Sanity only — the numbers are the deliverable, not a threshold.
    expect(exported.chars).toBeGreaterThan(0);
  });
}

test("DOCX: export a large document (lazy-loaded binary format)", async ({ page }) => {
  await page.goto("/");
  await loadLargeDocument(page);

  // Includes dynamically importing the docx package on first use, which is the
  // realistic cost a user pays.
  const downloadPromise = page.waitForEvent("download");
  const started = Date.now();
  await page.getByRole("button", { name: "Export DOCX" }).click();
  const download = await downloadPromise;
  const ms = Date.now() - started;

  console.log(`[serialize] docx     export ${String(ms).padStart(5)} ms (incl. lazy import)`);
  expect(download.suggestedFilename()).toBe("document.docx");
});
