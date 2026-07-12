import { describe, expect, it } from "vitest";

describe("@sbh321/docs-editor-react", () => {
  it("loads as an ES module", async () => {
    const mod = await import("./index");
    expect(mod).toBeDefined();
  });
});
