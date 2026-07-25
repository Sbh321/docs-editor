import { describe, expect, it } from "vitest";

import {
  InvalidAttributeError,
  InvalidContentError,
  UnknownMarkTypeError,
  UnknownNodeTypeError,
} from "../schema";
import { createFixtureSchema } from "../schema/schema.fixtures";

import { DocumentSerializer } from "./document-serializer";
import { InvalidSerializedDocumentError } from "./errors";

function createTestSerializer() {
  const schema = createFixtureSchema();
  return { schema, serializer: new DocumentSerializer(schema) };
}

describe("DocumentSerializer", () => {
  it("round-trips a document through a JSON string", () => {
    const { schema, serializer } = createTestSerializer();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello", [schema.mark("bold")])]),
    ]);

    const json = serializer.serialize(doc);
    expect(typeof json).toBe("string");

    const revived = serializer.deserialize(json);
    expect(revived).toEqual(doc);
  });

  it("deserializes already-parsed data, not just JSON strings", () => {
    const { schema, serializer } = createTestSerializer();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);

    const revived = serializer.deserialize(JSON.parse(serializer.serialize(doc)));
    expect(revived).toEqual(doc);
  });

  it("preserves attributes through the round trip", () => {
    const schema = createFixtureSchema();
    const serializer = new DocumentSerializer(schema);
    const link = schema.mark("link", { href: "https://example.com" });
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("click here", [link])]),
    ]);

    const revived = serializer.deserialize(serializer.serialize(doc));
    expect(revived.content[0]?.content[0]?.marks[0]?.attrs).toEqual({
      href: "https://example.com",
    });
  });

  it("rejects invalid JSON text", () => {
    const { serializer } = createTestSerializer();
    expect(() => serializer.deserialize("{not valid json")).toThrow(InvalidSerializedDocumentError);
  });

  it("rejects data that isn't shaped like a node", () => {
    const { serializer } = createTestSerializer();
    expect(() => serializer.deserialize({ notAType: true })).toThrow(
      InvalidSerializedDocumentError,
    );
    expect(() => serializer.deserialize("null")).toThrow(InvalidSerializedDocumentError);
    expect(() => serializer.deserialize('"just a string"')).toThrow(InvalidSerializedDocumentError);
  });

  it("rejects a mark that isn't shaped like a mark", () => {
    const { serializer } = createTestSerializer();
    expect(() =>
      serializer.deserialize({ type: "text", text: "hi", marks: [{ notAType: true }] }),
    ).toThrow(InvalidSerializedDocumentError);
  });

  it("rejects an unknown node type via the schema's own validation", () => {
    const { serializer } = createTestSerializer();
    expect(() => serializer.deserialize({ type: "nonexistent" })).toThrow(UnknownNodeTypeError);
  });

  it("rejects an unknown mark type via the schema's own validation", () => {
    const { serializer } = createTestSerializer();
    expect(() =>
      serializer.deserialize({ type: "text", text: "hi", marks: [{ type: "nonexistent" }] }),
    ).toThrow(UnknownMarkTypeError);
  });

  it("rejects a missing required attribute via the schema's own validation", () => {
    const { serializer } = createTestSerializer();
    expect(() =>
      serializer.deserialize({ type: "text", text: "hi", marks: [{ type: "link" }] }),
    ).toThrow(InvalidAttributeError);
  });

  it("rejects content that doesn't match the node's content expression", () => {
    const { serializer } = createTestSerializer();
    // doc requires at least one paragraph.
    expect(() => serializer.deserialize({ type: "doc", content: [] })).toThrow(InvalidContentError);
  });
});
