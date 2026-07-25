import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import {
  addColumnAfter,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  mergeCells,
} from "./table-commands";

/**
 * Builds a 2x2 table state with `tables: true`. Cell positions in this doc:
 * the first row's cells sit at positions 2 and 6, and a cursor at position 4
 * lands inside the first cell's paragraph text.
 */
function createTableState() {
  const schema = createFixtureSchema();
  const cell = (text: string) =>
    schema.node("table_cell", undefined, [
      schema.node("paragraph", undefined, [schema.text(text)]),
    ]);
  const row = (a: string, b: string) => schema.node("table_row", undefined, [cell(a), cell(b)]);
  const doc = schema.createDocument([
    schema.node("table", undefined, [row("A", "B"), row("C", "D")]),
  ]);
  return EditorState.create({ schema, doc, selection: { anchor: 4, head: 4 }, tables: true });
}

function createParagraphState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 }, tables: true });
}

describe("table commands", () => {
  it("addRowAfter adds a row below the one containing the cursor", () => {
    const state = createTableState();
    let next = state;

    expect(addRowAfter(state, (tr) => (next = state.apply(tr)))).toBe(true);
    expect(next.doc.content[0]?.content).toHaveLength(3);
  });

  it("addRowBefore adds a row above the one containing the cursor", () => {
    const state = createTableState();
    let next = state;

    addRowBefore(state, (tr) => (next = state.apply(tr)));
    // The new (empty) row is now first; the original "A"/"B" row is second.
    const table = next.doc.content[0];
    expect(table?.content).toHaveLength(3);
    expect(table?.content[1]?.content[0]?.content[0]?.content[0]?.text).toBe("A");
  });

  it("addColumnAfter widens every row by one cell", () => {
    const state = createTableState();
    let next = state;

    addColumnAfter(state, (tr) => (next = state.apply(tr)));
    for (const tableRow of next.doc.content[0]?.content ?? []) {
      expect(tableRow.content).toHaveLength(3);
    }
  });

  it("deleteRow removes the row containing the cursor", () => {
    const state = createTableState();
    let next = state;

    deleteRow(state, (tr) => (next = state.apply(tr)));
    const table = next.doc.content[0];
    expect(table?.content).toHaveLength(1);
    expect(table?.content[0]?.content[0]?.content[0]?.content[0]?.text).toBe("C");
  });

  it("deleteColumn narrows every row by one cell", () => {
    const state = createTableState();
    let next = state;

    deleteColumn(state, (tr) => (next = state.apply(tr)));
    for (const tableRow of next.doc.content[0]?.content ?? []) {
      expect(tableRow.content).toHaveLength(1);
    }
  });

  it("mergeCells merges a rectangular cell selection into one cell", () => {
    const state = createTableState();
    // A cell selection spanning the first row's two cells. Each cell is
    // addressed by the position directly before it: cell 1 at 2, cell 2 at 7
    // (2 + the first cell's node size of 5: open + paragraph[3] + close).
    const selected = state.apply(state.tr.setSelection({ anchor: 2, head: 7, type: "cell" }));
    let next = selected;

    expect(mergeCells(selected, (tr) => (next = selected.apply(tr)))).toBe(true);
    // The first row now has a single cell with colspan 2.
    const firstRow = next.doc.content[0]?.content[0];
    expect(firstRow?.content).toHaveLength(1);
    expect(firstRow?.content[0]?.attrs.colspan).toBe(2);
  });

  it("deleteTable removes the whole table", () => {
    const state = createTableState();
    let next = state;

    deleteTable(state, (tr) => (next = state.apply(tr)));
    expect(next.doc.content.find((node) => node.type === "table")).toBeUndefined();
  });

  it("reports false and never dispatches when the selection isn't in a table", () => {
    const state = createParagraphState();
    let dispatched = false;

    expect(addRowAfter(state, () => (dispatched = true))).toBe(false);
    expect(deleteTable(state, () => (dispatched = true))).toBe(false);
    expect(dispatched).toBe(false);
  });
});
