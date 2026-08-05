/**
 * Media-heavy benchmarks (ROADMAP Phase 7, Milestone 7.7).
 *
 * The Phase 6 budgets were set against text-heavy documents. This asks whether
 * they still hold when the document is mostly media — PROJECT_SPEC's "hundreds
 * of images". The headline remains the same one Phase 6 established: a
 * keystroke must cost the same regardless of what the rest of the document
 * contains, so a curve that tracks media count is the regression to catch.
 */

import { bench, describe } from "vitest";

import { mediaNodeRenderers } from "../media";
import { HtmlExporter } from "../serialization";
import { EditorState } from "../state";

import { mediaBenchmarkSchema, mediaDocument } from "./media-fixtures";

import type { MediaFixtureNodeName, MediaScaleName } from "./media-fixtures";

const schema = mediaBenchmarkSchema();
const SCALES: readonly MediaScaleName[] = ["few", "hundreds", "mixed", "extreme"];

/** A state whose cursor sits in the first paragraph, ready to type into. */
function stateFor(scale: MediaScaleName): EditorState {
  return EditorState.create({
    schema,
    doc: mediaDocument(scale, schema),
    selection: { anchor: 1, head: 1 },
    history: true,
  });
}

const states = new Map(SCALES.map((scale) => [scale, stateFor(scale)]));

describe("keystroke into a media-heavy document", () => {
  for (const scale of SCALES) {
    const state = states.get(scale) as EditorState;
    bench(`apply one insertText (${scale})`, () => {
      state.apply(state.tr.insertText("x", 1, 1));
    });
  }
});

describe("EditorState.create (media-heavy)", () => {
  for (const scale of SCALES) {
    const doc = mediaDocument(scale, schema);
    bench(`create (${scale})`, () => {
      EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 }, history: true });
    });
  }
});

describe("document conversion (media-heavy)", () => {
  for (const scale of SCALES) {
    const state = states.get(scale) as EditorState;
    bench(`read state.doc (${scale})`, () => {
      // Memoized after the first read within a state (6.2), so this measures
      // the cached path — the one a render actually takes.
      void state.doc;
    });
  }
});

describe("HTML export (media-heavy)", () => {
  const exporter = new HtmlExporter({
    schema,
    nodeRenderers: {
      ...mediaNodeRenderers<MediaFixtureNodeName>(),
      paragraph: () => ["p", 0],
      heading: () => ["h2", 0],
    },
  });

  for (const scale of SCALES) {
    const doc = mediaDocument(scale, schema);
    bench(`serialize (${scale})`, () => {
      exporter.serialize(doc);
    });
  }
});
