import { describe, expect, it } from "vitest";

import {
  defaultPageLayout,
  marginsToCss,
  MARGIN_PRESETS,
  PAGE_SIZES,
  resolvePageDimensions,
  toCssLength,
} from "./page-layout";

describe("PAGE_SIZES", () => {
  it("defines A4 in millimetres and Letter in inches", () => {
    expect(PAGE_SIZES.A4).toEqual({ name: "A4", width: 210, height: 297, unit: "mm" });
    expect(PAGE_SIZES.Letter).toEqual({ name: "Letter", width: 8.5, height: 11, unit: "in" });
  });
});

describe("resolvePageDimensions", () => {
  it("returns portrait dimensions as-is", () => {
    expect(resolvePageDimensions("A4", "portrait")).toEqual({
      width: 210,
      height: 297,
      unit: "mm",
    });
  });

  it("swaps width and height for landscape", () => {
    expect(resolvePageDimensions("A4", "landscape")).toEqual({
      width: 297,
      height: 210,
      unit: "mm",
    });
  });
});

describe("CSS helpers", () => {
  it("formats a length with its unit", () => {
    expect(toCssLength(210, "mm")).toBe("210mm");
    expect(toCssLength(8.5, "in")).toBe("8.5in");
  });

  it("formats margins as a top/right/bottom/left shorthand", () => {
    expect(marginsToCss(MARGIN_PRESETS.narrow)).toBe("0.5in 0.5in 0.5in 0.5in");
    expect(marginsToCss({ top: 1, right: 2, bottom: 1, left: 2, unit: "in" })).toBe(
      "1in 2in 1in 2in",
    );
  });
});

describe("defaultPageLayout", () => {
  it("is A4 portrait with normal margins", () => {
    expect(defaultPageLayout.size).toBe("A4");
    expect(defaultPageLayout.orientation).toBe("portrait");
    expect(defaultPageLayout.margins).toEqual(MARGIN_PRESETS.normal);
  });
});
