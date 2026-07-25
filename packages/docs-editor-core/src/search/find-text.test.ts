import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import { findText } from "./find-text";

describe("findText", () => {
  it("finds a single match, at the correct position", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello World")]),
    ]);

    // "World" starts at text index 6; the paragraph's text starts at
    // position 1 (position 0 is the paragraph's own opening boundary).
    expect(findText(doc, "World")).toEqual([{ from: 7, to: 12 }]);
  });

  it("finds every occurrence", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("cat cat cat")]),
    ]);

    expect(findText(doc, "cat")).toEqual([
      { from: 1, to: 4 },
      { from: 5, to: 8 },
      { from: 9, to: 12 },
    ]);
  });

  it("is case-insensitive by default, and case-sensitive on request", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);

    expect(findText(doc, "hello")).toEqual([{ from: 1, to: 6 }]);
    expect(findText(doc, "hello", { caseSensitive: true })).toEqual([]);
  });

  it("finds a match spanning a mark boundary within the same textblock", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("Wor"),
        schema.text("ld", [schema.mark("bold")]),
      ]),
    ]);

    expect(findText(doc, "World")).toEqual([{ from: 1, to: 6 }]);
  });

  it("never matches across a block boundary", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("ab")]),
      schema.node("paragraph", undefined, [schema.text("cd")]),
    ]);

    // "bc" would only exist if the two paragraphs' text were (wrongly)
    // treated as contiguous.
    expect(findText(doc, "bc")).toEqual([]);
  });

  it("returns an empty array for an empty query", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);

    expect(findText(doc, "")).toEqual([]);
  });

  it("a match's range works directly as insertText's from/to — Replace is just this", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello World")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    const [match] = findText(state.doc, "World");
    if (!match) {
      throw new Error("Expected a match.");
    }
    const nextState = state.apply(state.tr.insertText("Universe", match.from, match.to));

    expect(nextState.doc.content[0]?.content[0]?.text).toBe("Hello Universe");
  });
});
