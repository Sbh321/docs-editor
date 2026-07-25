import { describe, expect, it } from "vitest";

import {
  InvalidAttributeError,
  InvalidContentError,
  InvalidMarkError,
  SchemaError,
  UnknownMarkTypeError,
  UnknownNodeTypeError,
} from "./errors";
import { createFixtureSchema } from "./schema.fixtures";

describe("Schema", () => {
  it("creates a valid document", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);

    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0]?.type).toBe("paragraph");
    expect(doc.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("rejects unknown node types", () => {
    const schema = createFixtureSchema();
    expect(() => schema.node("nonexistent" as never)).toThrow(UnknownNodeTypeError);
  });

  it("requires schema.text() for text node types", () => {
    const schema = createFixtureSchema();
    expect(() => schema.node("text")).toThrow(SchemaError);
  });

  it("rejects empty text", () => {
    const schema = createFixtureSchema();
    expect(() => schema.text("")).toThrow(SchemaError);
  });

  it("applies attribute defaults and rejects unknown or missing attributes", () => {
    const schema = createFixtureSchema();

    expect(schema.mark("bold").attrs).toEqual({});
    expect(() => schema.mark("link")).toThrow(InvalidAttributeError);
    expect(schema.mark("link", { href: "https://example.com" }).attrs).toEqual({
      href: "https://example.com",
    });
    expect(() => schema.node("paragraph", { bogus: true })).toThrow(InvalidAttributeError);
  });

  it("rejects unknown mark types", () => {
    const schema = createFixtureSchema();
    expect(() => schema.text("hi", [{ type: "italic", attrs: {} }])).toThrow(UnknownMarkTypeError);
  });

  it("enforces per-node mark constraints", () => {
    const schema = createFixtureSchema();
    const bold = schema.mark("bold");

    // paragraph declares no "marks" -> defaults to "none"
    expect(() => schema.node("paragraph", undefined, [], [bold])).toThrow(InvalidMarkError);

    // text declares marks: "all"
    expect(schema.text("hi", [bold]).marks).toEqual([bold]);
  });

  it("validates content against the node's content expression", () => {
    const schema = createFixtureSchema();

    expect(() => schema.createDocument([])).toThrow(InvalidContentError);
    expect(() => schema.node("doc", undefined, [schema.text("stray")])).toThrow(
      InvalidContentError,
    );
  });

  it("produces frozen, immutable nodes", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([schema.node("paragraph")]);

    expect(Object.isFrozen(doc)).toBe(true);
    expect(Object.isFrozen(doc.content)).toBe(true);
    expect(() => {
      Array.prototype.push.call(doc.content, schema.node("paragraph"));
    }).toThrow();
  });

  it("blockType() validates a node type and defaults its attrs without requiring content", () => {
    const schema = createFixtureSchema();

    expect(schema.blockType("heading").attrs).toEqual({ level: 1 });
    expect(schema.blockType("heading", { level: 2 }).attrs).toEqual({ level: 2 });
    expect(() => schema.blockType("nonexistent" as never)).toThrow(UnknownNodeTypeError);
    expect(() => schema.blockType("text")).toThrow(SchemaError);
  });

  it("round-trips through JSON", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello", [schema.mark("bold")])]),
    ]);

    const roundTripped = JSON.parse(JSON.stringify(doc)) as typeof doc;

    expect(roundTripped).toEqual(JSON.parse(JSON.stringify(doc)));
    expect(roundTripped.content[0]?.content[0]?.text).toBe("Hello");
    expect(roundTripped.content[0]?.content[0]?.marks[0]?.type).toBe("bold");
  });
});
