import { describe, expect, it } from "vitest";

import { createSchema } from "../../schema";
import { createFixtureSchema } from "../../schema/schema.fixtures";
import { EngineConversionError } from "../errors";

import { compileEngineSchema } from "./compile-schema";
import { fromEngineNode, toEngineNode } from "./node-conversion";

import type { DocumentNode } from "../../schema";
import type { FixtureNodeName } from "../../schema/schema.fixtures";

function createEngineFixtureSchema() {
  return createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      note: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
      text: { group: "inline", isText: true, marks: "all" },
    },
    marks: { bold: {} },
  });
}

describe("toEngineNode / fromEngineNode", () => {
  it("round-trips a simple document", () => {
    const schema = createFixtureSchema();
    const engineSchema = compileEngineSchema(schema);
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);

    const engineNode = toEngineNode(engineSchema, doc);
    expect(engineNode.textContent).toBe("Hello");

    const roundTripped = fromEngineNode(engineNode);
    expect(roundTripped).toEqual(doc);
  });

  it("preserves marks through the round trip", () => {
    const schema = createFixtureSchema();
    const engineSchema = compileEngineSchema(schema);
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hi", [schema.mark("bold")])]),
    ]);

    const roundTripped = fromEngineNode(toEngineNode(engineSchema, doc));

    expect(roundTripped.content[0]?.content[0]?.marks).toEqual([{ type: "bold", attrs: {} }]);
  });

  it("preserves explicit and defaulted attributes", () => {
    const schema = createEngineFixtureSchema();
    const engineSchema = compileEngineSchema(schema);
    const doc = schema.createDocument([
      schema.node("note", { level: 2 }, [schema.text("explicit")]),
      schema.node("note", undefined, [schema.text("default")]),
    ]);

    const roundTripped = fromEngineNode(toEngineNode(engineSchema, doc));

    expect(roundTripped.content[0]?.attrs).toEqual({ level: 2 });
    expect(roundTripped.content[1]?.attrs).toEqual({ level: 1 });
  });

  it("produces frozen output, matching Schema's own immutability guarantee", () => {
    const schema = createFixtureSchema();
    const engineSchema = compileEngineSchema(schema);
    const doc = schema.createDocument([schema.node("paragraph")]);

    const roundTripped = fromEngineNode(toEngineNode(engineSchema, doc));

    expect(Object.isFrozen(roundTripped)).toBe(true);
    expect(Object.isFrozen(roundTripped.content)).toBe(true);
  });

  it("wraps ProseMirror validation failures in EngineConversionError", () => {
    const schema = createFixtureSchema();
    const engineSchema = compileEngineSchema(schema);
    const bogusNode = {
      type: "nonexistent",
      attrs: {},
      content: [],
      marks: [],
    } as unknown as DocumentNode;

    expect(() => toEngineNode(engineSchema, bogusNode)).toThrow(EngineConversionError);
  });

  it("rejects (as defense in depth) a hand-built mark missing a required attribute", () => {
    // Schema.text()/Schema.mark() would already reject this — this proves the
    // engine layer independently rejects it too, for node data that never
    // went through a Schema's validated constructors.
    const schema = createFixtureSchema();
    const engineSchema = compileEngineSchema(schema);
    const handBuiltTextNode = {
      type: "text",
      attrs: {},
      content: [],
      marks: [{ type: "link", attrs: {} }],
      text: "click",
    } as unknown as DocumentNode<FixtureNodeName>;
    const doc = schema.createDocument([schema.node("paragraph", undefined, [handBuiltTextNode])]);

    expect(() => toEngineNode(engineSchema, doc)).toThrow(EngineConversionError);
  });
});
