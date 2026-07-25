import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { getTextBefore } from "./text-before";

const schema = createFixtureSchema();

describe("getTextBefore", () => {
  it("returns the text from the start of the current block up to the position", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("/heading")]),
    ]);

    // Position 1 is the start of the paragraph's text; 9 is just after "/heading".
    expect(getTextBefore(doc, 9)).toBe("/heading");
    expect(getTextBefore(doc, 3)).toBe("/h");
  });

  it("never crosses a block boundary", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("first")]),
      schema.node("paragraph", undefined, [schema.text("/cmd")]),
    ]);

    // The second paragraph's text starts at position 8; "/cmd" ends at 12.
    // The result must not include "first" from the previous block.
    expect(getTextBefore(doc, 12)).toBe("/cmd");
    expect(getTextBefore(doc, 9)).toBe("/");
  });

  it("returns an empty string in a block with no text", () => {
    const doc = schema.createDocument([schema.node("paragraph", undefined, [])]);

    expect(getTextBefore(doc, 1)).toBe("");
  });
});
