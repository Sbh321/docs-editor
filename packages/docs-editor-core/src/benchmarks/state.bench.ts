/**
 * State and transaction benchmarks — the per-keystroke path.
 *
 * PROJECT_SPEC's "Performance First" says typing performance must never degrade
 * regardless of document size, so these are the phase's headline numbers: the
 * same single edit is applied to documents from 10 to 5000 paragraphs. A flat
 * curve across scales is the goal; a curve that tracks document size is the
 * regression to catch.
 */

import { bench, describe } from "vitest";

import { redo, undo } from "../commands";
import { EditorState } from "../state";

import { benchmarkDocument, benchmarkSchema } from "./fixtures";

import type { BenchmarkScaleName } from "./fixtures";

const schema = benchmarkSchema();
const SCALES: readonly BenchmarkScaleName[] = ["small", "medium", "large", "huge"];

/** A state whose cursor sits inside the first text block, ready to type into. */
function stateFor(scale: BenchmarkScaleName): EditorState {
  return EditorState.create({
    schema,
    doc: benchmarkDocument(scale, schema),
    selection: { anchor: 1, head: 1 },
    history: true,
  });
}

const states = new Map(SCALES.map((scale) => [scale, stateFor(scale)]));

describe("EditorState.create", () => {
  for (const scale of SCALES) {
    const doc = benchmarkDocument(scale, schema);
    bench(`create (${scale})`, () => {
      EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 }, history: true });
    });
  }
});

describe("transaction construction", () => {
  for (const scale of SCALES) {
    const state = states.get(scale)!;
    bench(`state.tr (${scale})`, () => {
      // Just opening a transaction — isolates the fixed cost from the edit.
      state.tr.insertText("x");
    });
  }
});

describe("apply a keystroke", () => {
  for (const scale of SCALES) {
    const state = states.get(scale)!;
    // Applied to the same base state each iteration, so this measures exactly
    // one keystroke's cost — never accumulated document growth.
    bench(`insertText + apply (${scale})`, () => {
      state.apply(state.tr.insertText("x"));
    });
  }
});

describe("selection change", () => {
  for (const scale of SCALES) {
    const state = states.get(scale)!;
    bench(`setSelection + apply (${scale})`, () => {
      state.apply(state.tr.setSelection({ anchor: 1, head: 5 }));
    });
  }
});

describe("undo / redo", () => {
  for (const scale of SCALES) {
    const base = states.get(scale)!;
    const edited = base.apply(base.tr.insertText("benchmark"));

    bench(`undo (${scale})`, () => {
      undo(edited, (transaction) => edited.apply(transaction));
    });

    let undone = edited;
    undo(edited, (transaction) => {
      undone = edited.apply(transaction);
    });
    bench(`redo (${scale})`, () => {
      redo(undone, (transaction) => undone.apply(transaction));
    });
  }
});
