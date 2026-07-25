import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { EditorState } from "./editor-state";

function createTestDoc(schema: ReturnType<typeof createFixtureSchema>) {
  return schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
}

describe("EditorState", () => {
  it("creates a state with the given document and selection", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);

    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    expect(state.doc).toEqual(doc);
    expect(state.selection).toEqual({ anchor: 1, head: 1 });
  });

  it("defaults the selection to a collapsed cursor when omitted", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);

    const state = EditorState.create({ schema, doc });

    expect(state.selection.anchor).toBe(state.selection.head);
  });

  it("apply() produces a new state and leaves the original untouched", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const nextState = state.apply(state.tr.insertText("Hi ", 1, 1));

    expect(nextState.doc.content[0]?.content[0]?.text).toBe("Hi Hello");
    expect(state.doc.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("delete() removes content", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    // Position 1 is just inside the paragraph (before "H"); position 6 is
    // just after "Hello" (before the paragraph's closing boundary).
    const nextState = state.apply(state.tr.delete(1, 6));

    expect(nextState.doc.content[0]?.content).toHaveLength(0);
  });

  it("insertNode() inserts a leaf node at the given position", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
      schema.node("paragraph", undefined, [schema.text("World")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    // Position 7 is between the two paragraphs.
    const nextState = state.apply(state.tr.insertNode(schema.node("divider"), 7, 7));

    expect(nextState.doc.content).toHaveLength(3);
    expect(nextState.doc.content[1]?.type).toBe("divider");
    expect(nextState.doc.content[1]?.content).toHaveLength(0);
  });

  it("insertNode() replaces a range instead of only inserting, when to > from", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const nextState = state.apply(state.tr.insertNode(schema.node("divider"), 0, 7));

    expect(nextState.doc.content).toHaveLength(1);
    expect(nextState.doc.content[0]?.type).toBe("divider");
  });

  it("insertNode() defaults to the current selection when no range is given", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 6, head: 6 } });

    const nextState = state.apply(state.tr.insertNode(schema.node("divider")));

    expect(nextState.doc.content).toHaveLength(2);
    expect(nextState.doc.content[1]?.type).toBe("divider");
  });

  it("maps the selection through an edit when not explicitly overridden", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    // Cursor just after "Hello" (position 6).
    const state = EditorState.create({ schema, doc, selection: { anchor: 6, head: 6 } });

    const nextState = state.apply(state.tr.insertText("Hi ", 1, 1));

    expect(nextState.selection).toEqual({ anchor: 9, head: 9 });
  });

  it("setSelection overrides the transaction's resulting selection", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const tr = state.tr.insertText("Hi ", 1, 1).setSelection({ anchor: 1, head: 1 });
    const nextState = state.apply(tr);

    expect(nextState.selection).toEqual({ anchor: 1, head: 1 });
  });

  it("reports docChanged only when an edit actually changed the document", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    expect(state.tr.docChanged).toBe(false);
    expect(state.tr.insertText("!", 6, 6).docChanged).toBe(true);
  });

  it("exposes the pre-transaction document via `before`", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const tr = state.tr.insertText("Hi ", 1, 1);

    expect(tr.before).toEqual(doc);
    expect(tr.doc).not.toEqual(doc);
  });

  it("addMark() applies a mark to the given range", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const nextState = state.apply(state.tr.addMark(1, 6, schema.mark("bold")));

    expect(nextState.doc.content[0]?.content[0]?.marks).toEqual([{ type: "bold", attrs: {} }]);
  });

  it("removeMark() removes a mark of the given type from the given range", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello", [schema.mark("bold")])]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const nextState = state.apply(state.tr.removeMark(1, 6, "bold"));

    expect(nextState.doc.content[0]?.content[0]?.marks).toEqual([]);
  });

  it("copy() extracts plain inline content with closed boundaries", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const copied = state.copy(1, 6);

    expect(copied.openStart).toBe(0);
    expect(copied.openEnd).toBe(0);
    expect(copied.content[0]?.text).toBe("Hello");
  });

  it("copy() then paste() duplicates content elsewhere in the document", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
      schema.node("paragraph", undefined, [schema.text("World")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const copied = state.copy(1, 6); // "Hello"
    // Position 8 is just inside the second paragraph, before "W".
    const nextState = state.apply(state.tr.paste(copied, 8, 8));

    expect(nextState.doc.content[1]?.content[0]?.text).toBe("HelloWorld");
  });

  it("paste() replaces the given range instead of only inserting", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
    const copied = state.copy(1, 6); // "Hello"

    // Positions 2-5 cover "ell", leaving "H" + "o"; replacing it with "Hello".
    const nextState = state.apply(state.tr.paste(copied, 2, 5));

    expect(nextState.doc.content[0]?.content[0]?.text).toBe("HHelloo");
  });

  it("copy()/paste() default to the current selection when no range is given", () => {
    const schema = createFixtureSchema();
    const doc = createTestDoc(schema);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } });

    const copied = state.copy();
    expect(copied.content[0]?.text).toBe("Hello");

    const nextState = state.apply(state.tr.paste(copied));
    expect(nextState.doc.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("copies a range spanning two paragraphs with open boundaries", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
      schema.node("paragraph", undefined, [schema.text("World")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    // From mid-"Hello" (position 3) to mid-"World" (position 10): cuts into
    // a paragraph boundary on both ends.
    const copied = state.copy(3, 10);

    expect(copied.openStart).toBeGreaterThan(0);
    expect(copied.openEnd).toBeGreaterThan(0);
  });
});
