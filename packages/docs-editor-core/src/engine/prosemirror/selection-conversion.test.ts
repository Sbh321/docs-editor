import { CellSelection } from "prosemirror-tables";
import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../../schema/schema.fixtures";

import { compileEngineSchema } from "./compile-schema";
import { toEngineNode } from "./node-conversion";
import { fromEngineSelection, toEngineSelection } from "./selection-conversion";

import type { Node as ProseMirrorNode } from "prosemirror-model";

/** Builds a 1-row, 2-cell table document in the engine, plus its cell positions. */
function createTableDoc(): { doc: ProseMirrorNode; cellPositions: number[] } {
  const schema = createFixtureSchema();
  const cell = (text: string) =>
    schema.node("table_cell", undefined, [
      schema.node("paragraph", undefined, [schema.text(text)]),
    ]);
  const doc = schema.createDocument([
    schema.node("table", undefined, [schema.node("table_row", undefined, [cell("A"), cell("B")])]),
  ]);

  const engineSchema = compileEngineSchema(schema);
  const engineDoc = toEngineNode(engineSchema, doc);

  const cellPositions: number[] = [];
  engineDoc.descendants((node, pos) => {
    if (node.type.spec.tableRole === "cell") {
      cellPositions.push(pos);
    }
    return true;
  });
  return { doc: engineDoc, cellPositions };
}

describe("selection conversion", () => {
  it("round-trips an ordinary text selection with no type discriminant", () => {
    const schema = createFixtureSchema();
    const engineSchema = compileEngineSchema(schema);
    const doc = toEngineNode(
      engineSchema,
      schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]),
    );

    const engineSelection = toEngineSelection(doc, { anchor: 1, head: 4 });
    expect(fromEngineSelection(engineSelection)).toEqual({ anchor: 1, head: 4 });
  });

  it("builds a CellSelection from a { type: 'cell' } selection", () => {
    const { doc, cellPositions } = createTableDoc();
    const [firstCell, secondCell] = cellPositions;
    if (firstCell === undefined || secondCell === undefined) {
      throw new Error("Expected two cells.");
    }

    const engineSelection = toEngineSelection(doc, {
      anchor: firstCell,
      head: secondCell,
      type: "cell",
    });

    expect(engineSelection).toBeInstanceOf(CellSelection);
  });

  it("reads a CellSelection back as { type: 'cell' } addressed by cell position", () => {
    const { doc, cellPositions } = createTableDoc();
    const [firstCell, secondCell] = cellPositions;
    if (firstCell === undefined || secondCell === undefined) {
      throw new Error("Expected two cells.");
    }

    const cellSelection = CellSelection.create(doc, firstCell, secondCell);
    const selection = fromEngineSelection(cellSelection);

    expect(selection).toEqual({ anchor: firstCell, head: secondCell, type: "cell" });
  });

  it("round-trips a cell selection through both conversions unchanged", () => {
    const { doc, cellPositions } = createTableDoc();
    const [firstCell, secondCell] = cellPositions;
    if (firstCell === undefined || secondCell === undefined) {
      throw new Error("Expected two cells.");
    }

    const original = { anchor: firstCell, head: secondCell, type: "cell" as const };
    const roundTripped = fromEngineSelection(toEngineSelection(doc, original));

    expect(roundTripped).toEqual(original);
  });
});
