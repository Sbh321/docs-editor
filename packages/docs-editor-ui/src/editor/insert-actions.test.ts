import { createSchema, EditorState } from "@sbh321/docs-editor-core";
import { defaultSchema } from "@sbh321/docs-editor-core/preset";
import { describe, expect, it } from "vitest";

import { defaultSlashItems, insertTable } from "./insert-actions";

import type { Schema } from "@sbh321/docs-editor-core";

/**
 * The default slash items (ROADMAP Phase 9, Milestone 9.10).
 *
 * Two claims worth pinning. Every item applies against the default schema —
 * an item that cannot run is a menu entry that lies. And against a schema
 * *missing* its type, every item declines instead of throwing, because a
 * command that throws takes the whole menu down with it.
 */

// Widened to `Schema<string, string>`: the slash items are `Command`s over
// *any* schema, so the test speaks the same type they do.
const anySchema = defaultSchema as unknown as Schema;

const defaultState = () =>
  EditorState.create({
    schema: anySchema,
    doc: anySchema.createDocument([
      anySchema.node("paragraph", undefined, [anySchema.text("Hello")]),
    ]),
    selection: { anchor: 1, head: 1 },
  });

// The smallest legal schema: paragraphs of text and nothing else.
const bareSchema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true, marks: "all" },
  },
  marks: {},
});

const bareState = () =>
  EditorState.create({
    schema: bareSchema,
    doc: bareSchema.createDocument([
      bareSchema.node("paragraph", undefined, [bareSchema.text("Hello")]),
    ]),
    selection: { anchor: 1, head: 1 },
  });

const DEFAULT_SLASH_ITEMS = defaultSlashItems();

describe("defaultSlashItems", () => {
  it("every item applies against the default schema", () => {
    for (const item of DEFAULT_SLASH_ITEMS) {
      // Dry run: reports applicable without dispatching.
      expect(item.command(defaultState()), item.id).toBe(true);
    }
  });

  it("every item declines — not throws — against a schema missing its type", () => {
    for (const item of DEFAULT_SLASH_ITEMS) {
      expect(() => item.command(bareState()), item.id).not.toThrow();
      expect(item.command(bareState()), item.id).toBe(false);
    }
  });

  it("actually performs the edit it names", () => {
    const state = defaultState();
    let next = state;
    DEFAULT_SLASH_ITEMS.find((item) => item.id === "h2")?.command(state, (tr) => {
      next = state.apply(tr);
    });
    expect(next.doc.content[0]?.type).toBe("heading");
    expect(next.doc.content[0]?.attrs.level).toBe(2);
  });
});

describe("insertTable", () => {
  it("inserts a table with a header row", () => {
    const state = defaultState();
    let next = state;
    insertTable(2, 3)(state, (tr) => {
      next = state.apply(tr);
    });

    const table = next.doc.content.find((node) => node.type === "table");
    expect(table).toBeDefined();
    expect(table?.content).toHaveLength(2);
    expect(table?.content[0]?.content.map((cell) => cell.type)).toEqual([
      "table_header",
      "table_header",
      "table_header",
    ]);
  });
});
