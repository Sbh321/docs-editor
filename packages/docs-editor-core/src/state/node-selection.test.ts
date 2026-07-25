import { describe, expect, it } from "vitest";

import { deleteSelection } from "../commands";
import { createFixtureSchema } from "../schema/schema.fixtures";

import { EditorState } from "./editor-state";

const schema = createFixtureSchema();

function stateWithDivider() {
  const doc = schema.createDocument([
    schema.node("paragraph", undefined, [schema.text("Hi")]),
    schema.node("divider"),
  ]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
}

describe("Transaction.selectNode", () => {
  it("selects a leaf node as a unit, reading back as type 'node'", () => {
    const state = stateWithDivider();
    // The divider (a leaf) sits at position 4; selecting it brackets it 4..5.
    const next = state.apply(state.tr.selectNode(4));

    expect(next.selection.type).toBe("node");
    expect(next.selection.anchor).toBe(4);
    expect(next.selection.head).toBe(5);
  });

  it("round-trips a node selection through apply()", () => {
    const state = stateWithDivider();
    const selected = state.apply(state.tr.selectNode(4));

    // Applying a no-op keeps the node selection intact (conversion both ways).
    const again = selected.apply(selected.tr.setSelection(selected.selection));
    expect(again.selection.type).toBe("node");
  });

  it("deletes a selected leaf node with deleteSelection", () => {
    const state = stateWithDivider();
    const selected = state.apply(state.tr.selectNode(4));

    let next = selected;
    deleteSelection(selected, (transaction) => {
      next = selected.apply(transaction);
    });

    expect(next.doc.content.some((node) => node.type === "divider")).toBe(false);
    expect(next.doc.content).toHaveLength(1);
  });

  it("fails with an actionable error when the position is out of range", () => {
    const state = stateWithDivider();
    expect(() => state.apply(state.tr.selectNode(9999))).toThrow();
  });
});
