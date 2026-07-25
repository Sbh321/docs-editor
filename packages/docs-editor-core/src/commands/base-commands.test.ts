import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import { baseKeymap, joinBackward, liftEmptyBlock, splitBlock } from "./base-commands";

import type { Command } from "./types";
import type { FixtureMarkName, FixtureNodeName } from "../schema/schema.fixtures";
import type { Selection } from "../selection";

const schema = createFixtureSchema();

type FixtureState = EditorState<FixtureNodeName, FixtureMarkName>;

function stateWith(paragraphs: readonly string[], selection: Selection): FixtureState {
  const doc = schema.createDocument(
    paragraphs.map((text) => schema.node("paragraph", undefined, text ? [schema.text(text)] : [])),
  );
  return EditorState.create({ schema, doc, selection });
}

function run(
  state: FixtureState,
  command: Command<FixtureNodeName, FixtureMarkName>,
): FixtureState {
  let next = state;
  command(state, (transaction) => {
    next = state.apply(transaction);
  });
  return next;
}

describe("splitBlock", () => {
  it("splits a textblock at the cursor into two", () => {
    // "Hello" in one paragraph; cursor after "He" (position 3).
    const next = run(stateWith(["Hello"], { anchor: 3, head: 3 }), splitBlock);

    expect(next.doc.content).toHaveLength(2);
    expect(next.doc.content[0]?.content[0]?.text).toBe("He");
    expect(next.doc.content[1]?.content[0]?.text).toBe("llo");
  });
});

describe("joinBackward", () => {
  it("joins a textblock into the previous one at its start", () => {
    // "Hello" (1..6) then "World"; the second paragraph starts at position 8.
    const next = run(stateWith(["Hello", "World"], { anchor: 8, head: 8 }), joinBackward);

    expect(next.doc.content).toHaveLength(1);
    expect(next.doc.content[0]?.content[0]?.text).toBe("HelloWorld");
  });

  it("reports false with nothing to join backward into", () => {
    expect(joinBackward(stateWith(["Hello"], { anchor: 1, head: 1 }))).toBe(false);
  });
});

describe("liftEmptyBlock", () => {
  it("lifts an empty paragraph out of a blockquote", () => {
    const doc = schema.createDocument([
      schema.node("blockquote", undefined, [schema.node("paragraph", undefined, [])]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 2, head: 2 } });
    const next = run(state, liftEmptyBlock);

    // The empty paragraph is lifted to the top level; the blockquote is gone.
    expect(next.doc.content.some((node) => node.type === "blockquote")).toBe(false);
    expect(next.doc.content.some((node) => node.type === "paragraph")).toBe(true);
  });
});

describe("baseKeymap", () => {
  it("exposes the essential bindings", () => {
    expect(typeof baseKeymap["Enter"]).toBe("function");
    expect(typeof baseKeymap["Backspace"]).toBe("function");
    expect(typeof baseKeymap["Delete"]).toBe("function");
  });

  it("Enter splits the current textblock", () => {
    const enter = baseKeymap["Enter"];
    expect(enter).toBeDefined();

    // baseKeymap values are schema-agnostic Command<string, string>; running one
    // against a specifically-typed state is sound (the engine is the same).
    const next = run(
      stateWith(["Hello"], { anchor: 3, head: 3 }),
      enter as Command<FixtureNodeName, FixtureMarkName>,
    );

    expect(next.doc.content).toHaveLength(2);
  });
});
