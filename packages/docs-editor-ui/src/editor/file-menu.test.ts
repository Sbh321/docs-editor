import { describe, expect, it } from "vitest";

import { importFormatForFile } from "./file-menu";

/**
 * The extension mapping is the part of the File menu a unit test can hold
 * still: pick the wrong importer and a .docx goes through the text path and
 * corrupts. The interactive flow — picker, downloads, print window — is
 * browser behaviour and lives in the Playwright suite.
 */
describe("importFormatForFile", () => {
  it("maps every accepted extension, case-insensitively", () => {
    expect(importFormatForFile("notes.json")).toBe("json");
    expect(importFormatForFile("notes.md")).toBe("markdown");
    expect(importFormatForFile("notes.markdown")).toBe("markdown");
    expect(importFormatForFile("notes.html")).toBe("html");
    expect(importFormatForFile("notes.htm")).toBe("html");
    expect(importFormatForFile("Report.DOCX")).toBe("docx");
  });

  it("declines what it cannot import rather than guessing", () => {
    expect(importFormatForFile("archive.zip")).toBeNull();
    expect(importFormatForFile("no-extension")).toBeNull();
    // Only the last extension decides — a name is not a format.
    expect(importFormatForFile("notes.md.zip")).toBeNull();
  });
});
