/**
 * Query benchmarks — the read paths that run on every render or keystroke.
 *
 * ARCHITECTURE asks for "efficient document traversal" and warns against
 * "expensive document traversals" (CLAUDE.md too). Active-state queries in
 * particular run on every render of every toolbar button, and search/outline
 * traverse the whole document, so their cost against document size is what
 * decides how much memoization Milestone 6.3 needs.
 */

import { bench, describe } from "vitest";

import { getOutline } from "../outline";
import { activeBlockType, activeMarks } from "../queries";
import { findText } from "../search";
import { EditorState } from "../state";

import { benchmarkDocument, benchmarkSchema } from "./fixtures";

import type { BenchmarkScaleName } from "./fixtures";

const schema = benchmarkSchema();
const SCALES: readonly BenchmarkScaleName[] = ["small", "medium", "large"];

const states = new Map(
  SCALES.map((scale) => [
    scale,
    EditorState.create({
      schema,
      doc: benchmarkDocument(scale, schema),
      selection: { anchor: 1, head: 5 },
    }),
  ]),
);

describe("findText (whole-document search)", () => {
  for (const scale of SCALES) {
    const state = states.get(scale)!;
    bench(`findText (${scale})`, () => {
      findText(state.doc, "document");
    });
  }
});

describe("getOutline (heading traversal)", () => {
  for (const scale of SCALES) {
    const state = states.get(scale)!;
    bench(`getOutline (${scale})`, () => {
      getOutline(state.doc);
    });
  }
});

describe("active-state queries (run on every render)", () => {
  for (const scale of SCALES) {
    const state = states.get(scale)!;
    bench(`activeMarks (${scale})`, () => {
      activeMarks(state);
    });
    bench(`activeBlockType (${scale})`, () => {
      activeBlockType(state);
    });
  }
});
