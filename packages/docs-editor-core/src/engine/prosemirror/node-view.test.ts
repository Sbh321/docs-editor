import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../../schema/schema.fixtures";
import { EngineConversionError } from "../errors";

import { createGenericMarkView, createGenericNodeView } from "./node-view";
import { createEngineState } from "./state";

function createTestEngineNode() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  const engineState = createEngineState(schema, doc, { anchor: 1, head: 1 });
  return engineState.doc.child(0);
}

describe("createGenericNodeView", () => {
  it("throws an actionable error when a renderer omits the leading tag name", () => {
    const node = createTestEngineNode();

    expect(() => createGenericNodeView(node, () => [] as never)).toThrow(EngineConversionError);
    expect(() => createGenericNodeView(node, () => [] as never)).toThrow(/tag name string/);
  });

  it("update() rebuilds (returns false) when the rendered spec changes", () => {
    const node = createTestEngineNode();
    let renderAsSpan = false;
    const view = createGenericNodeView(node, () => (renderAsSpan ? ["span", 0] : ["p", 0]));

    expect(view.dom.tagName.toLowerCase()).toBe("p");

    renderAsSpan = true;
    const updated = view.update?.(node, [], node as never);

    expect(updated).toBe(false);
  });
});

describe("createGenericMarkView", () => {
  it("throws an actionable error when a renderer omits the leading tag name", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hi", [schema.mark("bold")])]),
    ]);
    const engineState = createEngineState(schema, doc, { anchor: 1, head: 1 });
    const mark = engineState.doc.child(0).child(0).marks[0];
    if (!mark) {
      throw new Error("Expected the test fixture's text node to carry a mark.");
    }

    expect(() => createGenericMarkView(mark, () => [] as never)).toThrow(EngineConversionError);
  });
});
