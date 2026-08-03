import { describe, expect, it } from "vitest";

import { redo, undo } from "../commands";
import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorView } from "../view";

import { EditorState } from "./editor-state";

/**
 * Memory-bound regression tests (ROADMAP Phase 6, Milestone 6.5).
 *
 * ARCHITECTURE's Memory Management section requires that memory "grow
 * predictably" and forbids "unbounded history growth" and "retained detached
 * DOM nodes". Those are properties nothing else asserts — an editor that leaks
 * still passes every functional test — so they are pinned here.
 */

const schema = createFixtureSchema();

function createState(history: boolean | { depth?: number; newGroupDelay?: number }) {
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Start")])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 }, history });
}

/** Undoes until nothing is left, returning how many undo steps were available. */
function drainUndoStack(from: EditorState): number {
  let current = from;
  let steps = 0;
  for (;;) {
    let next: EditorState | null = null;
    const handled = undo(current, (transaction) => {
      next = current.apply(transaction);
    });
    if (!handled || next === null) {
      return steps;
    }
    current = next;
    steps += 1;
    // Guard so a genuinely unbounded stack fails loudly instead of hanging.
    if (steps > 500) {
      throw new Error("Undo stack did not terminate — history is unbounded.");
    }
  }
}

describe("history memory bounds", () => {
  it("discards the oldest events beyond the configured depth", () => {
    // `newGroupDelay: 0` stops the edits (which happen within microseconds of
    // each other) from collapsing into a single history event, so each one is
    // separately undoable and the depth cap is actually exercised.
    let state = createState({ depth: 5, newGroupDelay: 0 });
    for (let edit = 0; edit < 60; edit += 1) {
      state = state.apply(state.tr.insertText("x", 1, 1));
    }

    const steps = drainUndoStack(state);
    // 60 edits, depth 5 — the stack must be capped, not proportional to edits.
    expect(steps).toBeGreaterThan(0);
    expect(steps).toBeLessThanOrEqual(6);
  });

  it("keeps the cap stable as editing continues (memory does not creep)", () => {
    let state = createState({ depth: 5, newGroupDelay: 0 });
    for (let edit = 0; edit < 30; edit += 1) {
      state = state.apply(state.tr.insertText("a", 1, 1));
    }
    const afterFirstBurst = drainUndoStack(state);

    for (let edit = 0; edit < 300; edit += 1) {
      state = state.apply(state.tr.insertText("b", 1, 1));
    }
    const afterLongSession = drainUndoStack(state);

    // Ten times the editing must not mean a deeper stack.
    expect(afterLongSession).toBe(afterFirstBurst);
  });

  it("still supports undo/redo within the retained window", () => {
    let state = createState({ depth: 5, newGroupDelay: 0 });
    state = state.apply(state.tr.insertText("One ", 1, 1));
    const textAfterEdit = state.doc.content[0]?.content[0]?.text;

    let undone = state;
    undo(state, (transaction) => {
      undone = state.apply(transaction);
    });
    expect(undone.doc.content[0]?.content[0]?.text).not.toBe(textAfterEdit);

    let redone = undone;
    redo(undone, (transaction) => {
      redone = undone.apply(transaction);
    });
    expect(redone.doc.content[0]?.content[0]?.text).toBe(textAfterEdit);
  });
});

describe("view teardown", () => {
  it("detaches its DOM and releases the mount on destroy", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const view = new EditorView(mount, { state: createState(true) });
    expect(mount.childElementCount).toBe(1);

    view.destroy();

    // No detached-but-retained editor DOM left behind.
    expect(mount.childElementCount).toBe(0);
    mount.remove();
  });

  it("survives repeated mount/destroy cycles without accumulating DOM", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const view = new EditorView(mount, { state: createState(true) });
      view.setDecorations([{ from: 1, to: 3, attributes: { class: "hl" } }]);
      view.destroy();
    }

    expect(mount.childElementCount).toBe(0);
    mount.remove();
  });

  it("treats setDecorations after destroy as a no-op rather than throwing", () => {
    // Framework adapters clear decorations in effect cleanups, which can run
    // after the view is already destroyed on unmount.
    const mount = document.createElement("div");
    const view = new EditorView(mount, { state: createState(true) });
    view.destroy();

    expect(() => view.setDecorations([])).not.toThrow();
    expect(() =>
      view.setDecorations([{ from: 1, to: 2, attributes: { class: "x" } }]),
    ).not.toThrow();
  });
});
