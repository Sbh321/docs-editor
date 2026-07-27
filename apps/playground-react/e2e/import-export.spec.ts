import { expect, test } from "@playwright/test";

// Milestone 5.6: the playground's import/export panel drives the serialization
// registry (JSON, HTML, Markdown) and the print/PDF action end-to-end.

test("exports the current document to JSON", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Serialization format").selectOption("json");
  await page.getByRole("button", { name: "Export", exact: true }).click();

  const io = page.getByLabel("Serialized document");
  await expect(io).toHaveValue(/"type":\s*"doc"/);
  await expect(io).toHaveValue(/Hello, Docs Editor\./);
});

test("exports the current document to Markdown", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Serialization format").selectOption("markdown");
  await page.getByRole("button", { name: "Export", exact: true }).click();

  await expect(page.getByLabel("Serialized document")).toHaveValue(/Hello, Docs Editor\./);
});

test("imports a Markdown document, replacing the editor content", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  await page.getByLabel("Serialization format").selectOption("markdown");
  await page.getByLabel("Serialized document").fill("# Imported\n\nHas **bold** now.");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(editor.locator("h1")).toHaveText("Imported");
  await expect(editor.locator("strong")).toHaveText("bold");
  await expect(editor).not.toContainText("Hello, Docs Editor.");
});

test("round-trips through HTML: export then re-import preserves structure", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  // Make the document non-trivial first: turn the paragraph into a heading.
  await page.getByRole("button", { name: "Heading 1" }).click();
  await expect(editor.locator("h1")).toHaveText("Hello, Docs Editor.");

  await page.getByLabel("Serialization format").selectOption("html");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByLabel("Serialized document")).toHaveValue(
    /<h1>Hello, Docs Editor\.<\/h1>/,
  );

  // Re-importing the exported HTML rebuilds the same heading.
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(editor.locator("h1")).toHaveText("Hello, Docs Editor.");
});

test("DOCX round-trips through the UI: export downloads a .docx, re-import restores it", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".playground-editor");

  // Make the document distinctive, then export it to .docx.
  await page.getByRole("button", { name: 'Insert "Hi! "' }).click();
  await expect(editor).toContainText("Hi! Hello, Docs Editor.");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export DOCX" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("document.docx");
  const docxPath = await download.path();

  // Diverge the on-screen document so a successful import is observable.
  await page.getByRole("button", { name: 'Insert "Hi! "' }).click();
  await expect(editor).toContainText("Hi! Hi! Hello, Docs Editor.");

  // Import the downloaded file: the editor reverts to the exported content.
  await page.getByLabel("Import DOCX file").setInputFiles(docxPath);
  await expect(editor).toContainText("Hi! Hello, Docs Editor.");
  await expect(editor).not.toContainText("Hi! Hi!");
});

test("Print / PDF opens a clean print document generated from the model", async ({ page }) => {
  await page.goto("/");

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print / PDF" }).click();
  const popup = await popupPromise;

  await expect(popup.locator(".docs-editor-print")).toContainText("Hello, Docs Editor.");
  await popup.close();
});
