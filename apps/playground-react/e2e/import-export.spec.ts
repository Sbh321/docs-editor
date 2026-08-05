import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { exportDownload, loadMarkdownDocument } from "./load-document";
import { toolbarControl } from "./toolbar";

/**
 * The File menu (ROADMAP Phase 9, Milestone 9.11).
 *
 * Import, export and print used to be playground code, on the claim that they
 * were the application's. They are the editor's — every ingredient is
 * package-owned — so these now test the shipped `FileMenu` through
 * `<DocsEditor />`, and only a browser can prove them: real downloads, a real
 * file chooser, a real popup.
 */

const EDITOR = ".de-editor";

test("exports Markdown that round-trips the document", async ({ page }) => {
  await page.goto("/");

  const download = await exportDownload(page, "Export as Markdown");
  expect(download.suggestedFilename()).toBe("document.md");

  const path = await download.path();
  const markdown = await readFile(path, "utf8");
  expect(markdown).toMatch(/^# Docs Editor/m);
  expect(markdown).toContain("Hello, Docs Editor.");
});

test("exports HTML and JSON with real content", async ({ page }) => {
  await page.goto("/");

  const html = await exportDownload(page, "Export as HTML");
  expect(html.suggestedFilename()).toBe("document.html");
  expect(await readFile(await html.path(), "utf8")).toContain("<h1>Docs Editor</h1>");

  const json = await exportDownload(page, "Export as JSON");
  expect(json.suggestedFilename()).toBe("document.json");
  const parsed = JSON.parse(await readFile(await json.path(), "utf8")) as { type: string };
  expect(parsed.type).toBe("doc");
});

test("exports a DOCX file", async ({ page }) => {
  await page.goto("/");

  // The lazily-imported `docx` bundle has to load and produce real bytes.
  const download = await exportDownload(page, "Export as DOCX");
  expect(download.suggestedFilename()).toBe("document.docx");

  const bytes = await readFile(await download.path());
  // ZIP local-file-header magic "PK\x03\x04" — a .docx is a ZIP.
  expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test("imports Markdown through the file chooser", async ({ page }) => {
  await page.goto("/");

  await loadMarkdownDocument(page, "# Imported title\n\nImported body text.");

  await expect(page.locator(`${EDITOR} h1`)).toHaveText("Imported title");
  await expect(page.locator(EDITOR)).toContainText("Imported body text.");
});

test("a document round-trips: edit, export, re-import", async ({ page }) => {
  await page.goto("/");
  const editable = page.locator(`${EDITOR} [contenteditable='true']`);

  await editable.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Edited before export.");
  await expect(editable).toContainText("Edited before export.");

  const download = await exportDownload(page, "Export as Markdown");
  const markdown = await readFile(await download.path(), "utf8");

  // Wipe the document by importing something else, then bring the export back.
  await loadMarkdownDocument(page, "Placeholder.", "wipe.md");
  await expect(editable).not.toContainText("Edited before export.");

  await loadMarkdownDocument(page, markdown, "restored.md");
  await expect(editable).toContainText("Edited before export.");
});

test("opens a print window generated from the model", async ({ page, context }) => {
  await page.goto("/");

  await (await toolbarControl(page, "File")).click();
  const popup = context.waitForEvent("page");
  await page.getByRole("menuitem", { name: "Print" }).click();

  const printPage = await popup;
  await printPage.waitForLoadState("domcontentloaded");
  // Generated from the model: the document's text, none of the editor chrome.
  expect(await printPage.content()).toContain("Docs Editor");
  expect(await printPage.locator("[contenteditable]").count()).toBe(0);
});
