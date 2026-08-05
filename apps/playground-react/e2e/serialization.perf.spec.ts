import { readFile, stat } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { exportDownload, loadMarkdownDocument } from "./load-document";
import { toolbarControl } from "./toolbar";

import type { Page } from "@playwright/test";

/**
 * Serialization latency in a real browser (ROADMAP Phase 6, Milestone 6.7;
 * migrated to the shipped File menu in Phase 9, Milestone 9.11).
 *
 * The core micro-benchmarks run under jsdom, whose DOM implementation is far
 * slower than a browser's — so they overstate anything that touches the DOM
 * (HTML export and, especially, import). These measure the user-visible
 * latency of each format end to end, driven through the same File menu a user
 * drives.
 *
 * The numbers are not directly comparable with pre-9.11 runs: export used to
 * be timed to a textarea filling, and is now timed to the download event —
 * which includes blob creation and excludes rendering a megabyte of text into
 * a form control. The new measurement is the honest one; the old baseline is
 * simply a different quantity.
 */

const PARAGRAPHS = 1000;

const EXPORT_ITEMS = {
  json: "Export as JSON",
  html: "Export as HTML",
  markdown: "Export as Markdown",
} as const;

const IMPORT_NAMES = {
  json: "reimport.json",
  html: "reimport.html",
  markdown: "reimport.md",
} as const;

function largeMarkdown(): string {
  return Array.from(
    { length: PARAGRAPHS },
    (_, index) => `Paragraph ${index + 1} of the benchmark document with enough words to wrap.`,
  ).join("\n\n");
}

/**
 * Times re-importing exported bytes. The signal that the import landed is the
 * editable being **replaced**: importing remounts the editor session, so the
 * old element leaving the document is unambiguous where a text probe would
 * match the identical old content.
 */
async function timeImport(page: Page, name: string, buffer: Buffer): Promise<number> {
  const previous = await page.evaluateHandle(() =>
    document.querySelector("[contenteditable='true']"),
  );
  await (await toolbarControl(page, "File")).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Import…" }).click();

  const started = Date.now();
  await (await chooser).setFiles({ name, mimeType: "application/octet-stream", buffer });
  await page.waitForFunction(
    (old) => document.querySelector("[contenteditable='true']") !== old,
    previous,
    { timeout: 30_000 },
  );
  await expect(page.locator(".de-editor")).toContainText("Paragraph 1");
  return Date.now() - started;
}

for (const format of ["json", "html", "markdown"] as const) {
  test(`${format}: export and import a ${PARAGRAPHS}-paragraph document`, async ({ page }) => {
    await page.goto("/");
    await loadMarkdownDocument(page, largeMarkdown());

    const started = Date.now();
    const download = await exportDownload(page, EXPORT_ITEMS[format]);
    const exportMs = Date.now() - started;
    const path = await download.path();
    const bytes = (await stat(path)).size;

    const importMs = await timeImport(page, IMPORT_NAMES[format], await readFile(path));

    console.log(
      `[serialize] ${format.padEnd(8)} export ${String(exportMs).padStart(5)} ms ` +
        `(${(bytes / 1024).toFixed(0)} KB)   import ${String(importMs).padStart(5)} ms`,
    );

    // Sanity only — the numbers are the deliverable, not a threshold.
    expect(bytes).toBeGreaterThan(0);
  });
}

test("DOCX: export a large document (lazy-loaded binary format)", async ({ page }) => {
  await page.goto("/");
  await loadMarkdownDocument(page, largeMarkdown());

  // Includes dynamically importing the docx package on first use, which is the
  // realistic cost a user pays.
  const started = Date.now();
  const download = await exportDownload(page, "Export as DOCX");
  const ms = Date.now() - started;

  console.log(`[serialize] docx     export ${String(ms).padStart(5)} ms (incl. lazy import)`);
  expect(download.suggestedFilename()).toBe("document.docx");
});
