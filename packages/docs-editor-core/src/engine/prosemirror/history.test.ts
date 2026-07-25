import { EditorState as ProseMirrorEditorState } from "prosemirror-state";
import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../../schema/schema.fixtures";

import { compileEngineSchema } from "./compile-schema";
import { createEngineHistoryPlugin, runEngineRedo, runEngineUndo } from "./history";
import { toEngineNode } from "./node-conversion";

function createTestDocAndSchema() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  const engineSchema = compileEngineSchema(schema);
  const engineDoc = toEngineNode(engineSchema, doc);
  return { engineSchema, engineDoc };
}

describe("createEngineHistoryPlugin / runEngineUndo / runEngineRedo", () => {
  it("reports false when there is nothing to undo", () => {
    const { engineSchema, engineDoc } = createTestDocAndSchema();
    const state = ProseMirrorEditorState.create({
      schema: engineSchema,
      doc: engineDoc,
      plugins: [createEngineHistoryPlugin()],
    });

    expect(runEngineUndo(state)).toBe(false);
  });

  it("undoes and redoes an edit", () => {
    const { engineSchema, engineDoc } = createTestDocAndSchema();
    let state = ProseMirrorEditorState.create({
      schema: engineSchema,
      doc: engineDoc,
      plugins: [createEngineHistoryPlugin()],
    });

    state = state.apply(state.tr.insertText("Hi ", 1, 1));
    expect(state.doc.textContent).toBe("Hi Hello");

    let undone = state;
    expect(
      runEngineUndo(state, (tr) => {
        undone = state.apply(tr);
      }),
    ).toBe(true);
    expect(undone.doc.textContent).toBe("Hello");

    let redone = undone;
    expect(
      runEngineRedo(undone, (tr) => {
        redone = undone.apply(tr);
      }),
    ).toBe(true);
    expect(redone.doc.textContent).toBe("Hi Hello");
  });

  it("reports false when the history plugin was never installed", () => {
    const { engineSchema, engineDoc } = createTestDocAndSchema();
    const state = ProseMirrorEditorState.create({ schema: engineSchema, doc: engineDoc });

    expect(runEngineUndo(state)).toBe(false);
    expect(runEngineRedo(state)).toBe(false);
  });
});
