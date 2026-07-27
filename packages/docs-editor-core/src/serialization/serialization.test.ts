import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { DuplicateFormatError, UnknownFormatError } from "./errors";
import { JsonExporter, JsonImporter } from "./json";
import { SerializationRegistry } from "./registry";

import type { DocumentNode } from "../schema";

const schema = createFixtureSchema();

function sampleDoc() {
  return schema.createDocument([
    schema.node("heading", { level: 1 }, [schema.text("Title")]),
    schema.node("paragraph", undefined, [schema.text("Body", [schema.mark("bold")])]),
  ]);
}

describe("JsonExporter / JsonImporter", () => {
  it("round-trips a document exactly", () => {
    const doc = sampleDoc();
    const json = new JsonExporter(schema).serialize(doc);
    const back = new JsonImporter(schema).parse(json);

    expect(back).toEqual(doc);
  });

  it("validates through the schema on import (rejects unknown node types)", () => {
    const importer = new JsonImporter(schema);
    expect(() => importer.parse('{ "type": "bogus", "content": [] }')).toThrow();
  });

  it("exposes a stable format id", () => {
    expect(new JsonExporter(schema).format).toBe("json");
    expect(new JsonImporter(schema).format).toBe("json");
  });
});

describe("SerializationRegistry", () => {
  it("registers and runs importers/exporters by format", () => {
    const registry = new SerializationRegistry()
      .registerExporter(new JsonExporter(schema))
      .registerImporter(new JsonImporter(schema));

    expect(registry.exportFormats()).toEqual(["json"]);
    expect(registry.importFormats()).toEqual(["json"]);
    expect(registry.hasExporter("json")).toBe(true);
    expect(registry.hasImporter("html")).toBe(false);

    const doc = sampleDoc();
    const json = registry.export("json", doc);
    expect(registry.import("json", json)).toEqual(doc);
  });

  it("throws on a duplicate format registration", () => {
    const registry = new SerializationRegistry().registerExporter(new JsonExporter(schema));
    expect(() => registry.registerExporter(new JsonExporter(schema))).toThrow(DuplicateFormatError);
  });

  it("throws UnknownFormatError for an unregistered format", () => {
    const registry = new SerializationRegistry();
    expect(() => registry.export("html", sampleDoc() as DocumentNode)).toThrow(UnknownFormatError);
    expect(() => registry.import("markdown", "# Hi")).toThrow(UnknownFormatError);
  });
});
