import { describe, expect, it } from "vitest";

import { createSchema } from "../../schema";
import { createFixtureSchema } from "../../schema/schema.fixtures";
import { EngineSchemaError } from "../errors";

import { compileEngineSchema } from "./compile-schema";

describe("compileEngineSchema", () => {
  it("compiles node and mark type names", () => {
    const engineSchema = compileEngineSchema(createFixtureSchema());

    expect(Object.keys(engineSchema.nodes)).toEqual(
      expect.arrayContaining(["doc", "paragraph", "text"]),
    );
    expect(Object.keys(engineSchema.marks)).toEqual(expect.arrayContaining(["bold", "link"]));
    expect(engineSchema.topNodeType.name).toBe("doc");
  });

  it("derives each container's ProseMirror marks constraint from its possible content", () => {
    const engineSchema = compileEngineSchema(createFixtureSchema());

    // paragraph's content ("inline*") resolves to the "text" node type via
    // its group, and text declares marks: "all" -> paragraph's *compiled*
    // constraint is "_", even though paragraph itself declares no "marks".
    expect(engineSchema.nodes.paragraph?.spec.marks).toBe("_");
    // doc's content ("paragraph+") resolves to "paragraph", which declares
    // no marks of its own ("none") -> doc's compiled constraint is "".
    expect(engineSchema.nodes.doc?.spec.marks).toBe("");
  });

  it('unions an explicit mark list across every possible content type, and lets "all" win', () => {
    // "text" only allows "bold"; "emphasis" allows "all" -- since a single
    // ProseMirror container constraint can't express per-child differences,
    // "all" must win so neither child is ever wrongly rejected.
    const schema = createSchema({
      topNode: "doc",
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { group: "block", content: "inline*" },
        text: { group: "inline", isText: true, marks: ["bold"] },
        emphasis: { group: "inline", marks: "all", content: "", inline: true },
      },
      marks: { bold: {}, italic: {} },
    });

    const engineSchema = compileEngineSchema(schema);

    expect(engineSchema.nodes.paragraph?.spec.marks).toBe("_");
  });

  it('unions explicit mark lists when no possible content type allows "all"', () => {
    const schema = createSchema({
      topNode: "doc",
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { group: "block", content: "inline*" },
        text: { group: "inline", isText: true, marks: ["bold"] },
        emphasis: { group: "inline", marks: ["italic"], content: "", inline: true },
      },
      marks: { bold: {}, italic: {} },
    });

    const engineSchema = compileEngineSchema(schema);
    const marks = (engineSchema.nodes.paragraph?.spec.marks ?? "").split(" ").sort();

    expect(marks).toEqual(["bold", "italic"]);
  });

  it("preserves required (no-default) attributes", () => {
    const engineSchema = compileEngineSchema(createFixtureSchema());
    const linkType = engineSchema.marks.link;

    // No "default" key at all -- ProseMirror's own convention for "required".
    expect(linkType?.spec.attrs?.href).toEqual({});
    expect(linkType?.create({ href: "https://example.com" }).attrs.href).toBe(
      "https://example.com",
    );
  });

  it("propagates the code flag to the compiled node spec", () => {
    const engineSchema = compileEngineSchema(createFixtureSchema());

    expect(engineSchema.nodes.code_block?.spec.code).toBe(true);
    expect(engineSchema.nodes.paragraph?.spec.code).toBeUndefined();
  });

  it("propagates tableRole and isolating so the engine's table support recognizes the nodes", () => {
    const engineSchema = compileEngineSchema(createFixtureSchema());

    expect(engineSchema.nodes.table?.spec.tableRole).toBe("table");
    expect(engineSchema.nodes.table_row?.spec.tableRole).toBe("row");
    expect(engineSchema.nodes.table_cell?.spec.tableRole).toBe("cell");
    expect(engineSchema.nodes.table_header?.spec.tableRole).toBe("header_cell");
    expect(engineSchema.nodes.table_cell?.spec.isolating).toBe(true);
    expect(engineSchema.nodes.paragraph?.spec.tableRole).toBeUndefined();
    expect(engineSchema.nodes.paragraph?.spec.isolating).toBeUndefined();
  });

  it("rejects a schema with no text node type", () => {
    const schema = createSchema({
      topNode: "doc",
      nodes: { doc: { content: "paragraph+" }, paragraph: {} },
    });

    expect(() => compileEngineSchema(schema)).toThrow(EngineSchemaError);
  });

  it('rejects a schema whose text node type isn\'t named "text"', () => {
    const schema = createSchema({
      topNode: "doc",
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "inline*" },
        run: { group: "inline", isText: true },
      },
    });

    expect(() => compileEngineSchema(schema)).toThrow(EngineSchemaError);
  });
});
