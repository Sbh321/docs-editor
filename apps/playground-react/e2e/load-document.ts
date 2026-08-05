import { expect } from "@playwright/test";

import { toolbarControl } from "./toolbar";

import type { Page } from "@playwright/test";

/**
 * Loads a document by importing a Markdown file through the File menu — the
 * route a user has, driven exactly as a user drives it.
 *
 * The perf specs previously bulk-loaded through the playground's
 * import/export panel (a format dropdown and a textarea). That panel was the
 * kind of app-side scaffolding Milestone 9.11 abolished, so loading now rides
 * the shipped Import flow: Playwright answers the file chooser with an
 * in-memory buffer, no real file needed.
 */
export async function loadMarkdownDocument(
  page: Page,
  markdown: string,
  name = "load.md",
): Promise<void> {
  await (await toolbarControl(page, "File")).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Import…" }).click();
  await (
    await chooser
  ).setFiles({
    name,
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown, "utf8"),
  });
  // The import replaces the editor session; its content appearing is the
  // signal that the new document is live. Markdown block markers are stripped
  // from the probe, since "# Title" renders as "Title".
  const firstLine = markdown.split("\n").find((line) => line.trim().length > 0) ?? "";
  const probe = firstLine.replace(/^[#>*\-\d.\s]+|\[[ xX]\]\s*/g, "").slice(0, 24);
  await expect(page.locator("[contenteditable='true']")).toContainText(probe, {
    timeout: 30_000,
  });
}

/** Exports via the File menu, returning the Playwright download. */
export async function exportDownload(page: Page, itemLabel: string) {
  await (await toolbarControl(page, "File")).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: itemLabel }).click();
  return download;
}
