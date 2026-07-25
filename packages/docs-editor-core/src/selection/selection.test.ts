import { describe, expect, it } from "vitest";

import { isSelectionEmpty, selectionFrom, selectionTo } from "./selection";

describe("selection helpers", () => {
  it("derives from/to regardless of anchor/head direction", () => {
    expect(selectionFrom({ anchor: 3, head: 8 })).toBe(3);
    expect(selectionTo({ anchor: 3, head: 8 })).toBe(8);

    expect(selectionFrom({ anchor: 8, head: 3 })).toBe(3);
    expect(selectionTo({ anchor: 8, head: 3 })).toBe(8);
  });

  it("treats an equal anchor/head as empty", () => {
    expect(isSelectionEmpty({ anchor: 5, head: 5 })).toBe(true);
    expect(isSelectionEmpty({ anchor: 5, head: 6 })).toBe(false);
  });
});
