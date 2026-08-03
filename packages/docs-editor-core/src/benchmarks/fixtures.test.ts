import { describe, expect, it } from "vitest";

import { EditorState } from "../state";

import {
  BENCHMARK_SCALES,
  benchmarkDocument,
  benchmarkSchema,
  blockCount,
  createBenchmarkDocument,
} from "./fixtures";

const schema = benchmarkSchema();

describe("benchmark fixtures", () => {
  it("is deterministic — the same options produce an identical document", () => {
    const options = { paragraphs: 40, headingEvery: 5, tables: 2, images: 2, lists: 2 };
    const first = createBenchmarkDocument(schema, options);
    const second = createBenchmarkDocument(schema, options);

    // Byte-identical, so two benchmark runs measure the code, not the data.
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("varies with the seed", () => {
    const a = createBenchmarkDocument(schema, { paragraphs: 20, seed: 1 });
    const b = createBenchmarkDocument(schema, { paragraphs: 20, seed: 2 });

    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
  });

  it("produces schema-valid documents usable as editor state", () => {
    const doc = createBenchmarkDocument(schema, {
      paragraphs: 30,
      headingEvery: 5,
      tables: 2,
      images: 2,
      lists: 2,
    });

    // `createDocument` already validated it; this proves it also drives a real
    // EditorState (the thing the benchmarks actually measure).
    const state = EditorState.create({ schema, doc, history: true });
    expect(state.doc.content.length).toBeGreaterThan(30);

    const types = new Set(state.doc.content.map((node) => node.type));
    expect(types).toContain("paragraph");
    expect(types).toContain("heading");
    expect(types).toContain("table");
    expect(types).toContain("figure");
    expect(types).toContain("bullet_list");
  });

  it("scales block count with the requested paragraph count", () => {
    const small = createBenchmarkDocument(schema, { paragraphs: 10 });
    const larger = createBenchmarkDocument(schema, { paragraphs: 100 });

    expect(blockCount(small)).toBe(10);
    expect(blockCount(larger)).toBe(100);
  });

  it("memoizes a named scale so benchmarks reuse one instance", () => {
    expect(benchmarkDocument("small")).toBe(benchmarkDocument("small"));
    expect(blockCount(benchmarkDocument("small"))).toBe(BENCHMARK_SCALES.small.paragraphs);
  });

  it("carries inline marks so mark handling is exercised", () => {
    const doc = createBenchmarkDocument(schema, { paragraphs: 60, markedFraction: 1 });
    const marked = doc.content.filter((node) =>
      node.content.some((child) => child.marks.length > 0),
    );

    expect(marked.length).toBeGreaterThan(0);
  });
});
