import { describe, expect, it } from "vitest";

import { isClipboardContentEmpty } from "./clipboard-content";

describe("isClipboardContentEmpty", () => {
  it("is true for empty content", () => {
    expect(isClipboardContentEmpty({ content: [], openStart: 0, openEnd: 0 })).toBe(true);
  });

  it("is false when content has at least one node", () => {
    expect(
      isClipboardContentEmpty({
        content: [{ type: "text", attrs: {}, content: [], marks: [], text: "hi" }],
        openStart: 0,
        openEnd: 0,
      }),
    ).toBe(false);
  });
});
