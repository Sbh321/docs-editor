import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import { redo, undo } from "./history-commands";

function createTestDoc(schema: ReturnType<typeof createFixtureSchema>) {
  return schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
}

function createTestState() {
  const schema = createFixtureSchema();
  const doc = createTestDoc(schema);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 }, history: true });
}

describe("undo / redo", () => {
  it("report false when there is nothing to undo or redo", () => {
    const state = createTestState();

    expect(undo(state)).toBe(false);
    expect(redo(state)).toBe(false);
  });

  it("reverts an edit and restores it", () => {
    const state = createTestState();
    const afterEdit = state.apply(state.tr.insertText("Hi ", 1, 1));
    expect(afterEdit.doc.content[0]?.content[0]?.text).toBe("Hi Hello");

    let afterUndo = afterEdit;
    expect(
      undo(afterEdit, (tr) => {
        afterUndo = afterEdit.apply(tr);
      }),
    ).toBe(true);
    expect(afterUndo.doc.content[0]?.content[0]?.text).toBe("Hello");

    let afterRedo = afterUndo;
    expect(
      redo(afterUndo, (tr) => {
        afterRedo = afterUndo.apply(tr);
      }),
    ).toBe(true);
    expect(afterRedo.doc.content[0]?.content[0]?.text).toBe("Hi Hello");
  });

  it("dry-runs without a dispatch, leaving the state untouched", () => {
    const state = createTestState();
    const afterEdit = state.apply(state.tr.insertText("Hi ", 1, 1));

    expect(undo(afterEdit)).toBe(true);
    expect(afterEdit.doc.content[0]?.content[0]?.text).toBe("Hi Hello");
  });

  it("reports false when the state was created without history enabled", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
    const afterEdit = state.apply(state.tr.insertText("Hi ", 1, 1));

    expect(undo(afterEdit)).toBe(false);
  });
});
