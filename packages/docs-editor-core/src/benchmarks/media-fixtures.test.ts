import { describe, expect, it } from "vitest";

import {
  createMediaDocument,
  createMediaFixtureSchema,
  MEDIA_SCALES,
  mediaBenchmarkSchema,
  mediaCount,
  mediaDocument,
} from "./media-fixtures";

/**
 * The media fixtures are only useful if they are *deterministic* and actually
 * the size they claim — a benchmark measured against drifting input measures
 * nothing. These assertions are what let a regression be read as a code change
 * rather than a data change (ROADMAP Phase 7, Milestone 7.7).
 */

const schema = mediaBenchmarkSchema();

describe("media fixture determinism", () => {
  it("produces byte-identical documents for the same options", () => {
    const first = createMediaDocument(schema, { media: 20 });
    const second = createMediaDocument(schema, { media: 20 });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("produces different documents for different seeds", () => {
    const a = createMediaDocument(schema, { media: 20, seed: 1 });
    const b = createMediaDocument(schema, { media: 20, seed: 2 });

    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("is independent of the schema instance it is built against", () => {
    const other = createMediaFixtureSchema();
    expect(JSON.stringify(createMediaDocument(other, { media: 10 }))).toBe(
      JSON.stringify(createMediaDocument(schema, { media: 10 })),
    );
  });
});

describe("media fixture shape", () => {
  it("contains exactly the requested number of media nodes", () => {
    expect(mediaCount(createMediaDocument(schema, { media: 50 }))).toBe(50);
  });

  it("reaches the documented 'hundreds of images' target", () => {
    // PROJECT_SPEC states this target literally; if the scale is ever lowered,
    // the benchmarks stop measuring what the spec promises.
    expect(MEDIA_SCALES.hundreds.media).toBeGreaterThanOrEqual(200);
    expect(mediaCount(mediaDocument("hundreds"))).toBe(200);
  });

  it("wraps media in captioned figures by default", () => {
    const doc = createMediaDocument(schema, { media: 3 });
    const figures = doc.content.filter((node) => node.type === "figure");

    expect(figures).toHaveLength(3);
    expect(figures[0]?.content.map((child) => child.type)).toEqual(["image", "caption"]);
  });

  it("emits bare media when captions are disabled", () => {
    const doc = createMediaDocument(schema, { media: 3, captioned: false });

    expect(doc.content.some((node) => node.type === "figure")).toBe(false);
    expect(doc.content.filter((node) => node.type === "image")).toHaveLength(3);
  });

  it("cycles through every media type when mixed", () => {
    const doc = createMediaDocument(schema, { media: 10, mixedTypes: true, captioned: false });
    const types = new Set(doc.content.map((node) => node.type));

    for (const type of ["image", "video", "audio", "file", "embed"]) {
      expect(types).toContain(type);
    }
  });

  it("gives every media node a distinct source", () => {
    // Shared sources would let a cache keyed on `src` look faster than a real
    // document of distinct images ever could.
    const doc = createMediaDocument(schema, { media: 40, captioned: false });
    const sources = doc.content
      .filter((node) => node.type === "image")
      .map((node) => node.attrs.src);

    expect(new Set(sources).size).toBe(sources.length);
  });

  it("memoizes each named scale", () => {
    // Building an 800-media document validates every node; repeating that
    // inside a benchmark loop would measure fixture construction instead.
    expect(mediaDocument("few")).toBe(mediaDocument("few"));
  });
});
