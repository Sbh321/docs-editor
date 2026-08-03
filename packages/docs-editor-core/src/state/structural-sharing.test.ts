import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { EditorState } from "./editor-state";

/**
 * Regression tests for the Phase 6 / Milestone 6.2 optimization.
 *
 * `EditorState.doc` is converted lazily and memoized per engine node, which is
 * what keeps a keystroke's cost proportional to the *change* rather than the
 * *document* (see docs/PERFORMANCE.md). These assert the properties that make
 * that true, so a future refactor cannot silently reintroduce the O(document)
 * conversion — the benchmarks would show it, but nothing would fail.
 */

const schema = createFixtureSchema();

function documentOfParagraphs(count: number) {
  return schema.createDocument(
    Array.from({ length: count }, (_, index) =>
      schema.node("paragraph", undefined, [schema.text(`Paragraph ${index + 1}`)]),
    ),
  );
}

function stateOfParagraphs(count: number) {
  return EditorState.create({
    schema,
    doc: documentOfParagraphs(count),
    selection: { anchor: 1, head: 1 },
    history: true,
  });
}

describe("EditorState.doc structural sharing", () => {
  it("reuses the identical node objects for subtrees an edit did not touch", () => {
    const state = stateOfParagraphs(20);
    const before = state.doc;

    // Type into the first paragraph.
    const after = state.apply(state.tr.insertText("X")).doc;

    // The edited paragraph is a new object...
    expect(after.content[0]).not.toBe(before.content[0]);
    // ...but every untouched sibling is the *same* object, which is what makes
    // downstream memoization (React.memo, useMemo) actually skip work.
    for (let index = 1; index < before.content.length; index += 1) {
      expect(after.content[index]).toBe(before.content[index]);
    }
  });

  it("returns an identical document when only the selection changed", () => {
    const state = stateOfParagraphs(20);
    const before = state.doc;

    const moved = state.apply(state.tr.setSelection({ anchor: 5, head: 9 }));

    // A selection change edits no content, so the whole document — root
    // included — must come back identical. This is the property that turns a
    // cursor move from O(document) into O(1).
    expect(moved.doc).toBe(before);
    expect(moved.selection.anchor).toBe(5);
    expect(moved.selection.head).toBe(9);
  });

  it("memoizes doc so repeated reads return the same object", () => {
    const state = stateOfParagraphs(5);
    expect(state.doc).toBe(state.doc);
  });

  it("still reflects edits correctly (laziness must not stale the document)", () => {
    const state = stateOfParagraphs(3);
    const next = state.apply(state.tr.insertText("Hello "));

    expect(next.doc.content[0]?.content[0]?.text).toBe("Hello Paragraph 1");
    // The original state is immutable and unaffected.
    expect(state.doc.content[0]?.content[0]?.text).toBe("Paragraph 1");
  });

  it("produces a document that is deeply frozen", () => {
    const state = stateOfParagraphs(3);
    const doc = state.doc;

    expect(Object.isFrozen(doc)).toBe(true);
    expect(Object.isFrozen(doc.content)).toBe(true);
    expect(Object.isFrozen(doc.content[0])).toBe(true);
    expect(Object.isFrozen(doc.content[0]?.attrs)).toBe(true);
  });

  it("keeps sharing across a chain of edits, so cost never compounds", () => {
    let state = stateOfParagraphs(30);
    const original = state.doc;

    // Ten successive edits, all in the first paragraph.
    for (let edit = 0; edit < 10; edit += 1) {
      state = state.apply(state.tr.insertText("x", 1, 1));
    }

    // The far end of the document is still the object it started as — the
    // sharing survives repeated transactions rather than decaying.
    expect(state.doc.content[29]).toBe(original.content[29]);
    expect(state.doc.content[0]).not.toBe(original.content[0]);
  });
});
