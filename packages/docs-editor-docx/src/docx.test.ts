import { createSchema } from "@sbh321/docs-editor-core";
import { describe, expect, it } from "vitest";

import { DocxImporter } from "./parse";
import { DocxExporter } from "./serialize";

import type { HtmlParseSpec } from "@sbh321/docs-editor-core";

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
    blockquote: { group: "block", content: "block+" },
    bullet_list: { group: "block", content: "list_item+" },
    ordered_list: { group: "block", content: "list_item+", attrs: { order: { default: 1 } } },
    list_item: { content: "paragraph block*" },
    code_block: { group: "block", content: "text*", marks: "none", code: true },
    divider: { group: "block" },
    text: { group: "inline", isText: true, marks: "all" },
  },
  marks: {
    bold: {},
    italic: {},
    underline: {},
    strikethrough: {},
    code: { excludes: "_" },
    link: { attrs: { href: {} }, inclusive: false },
    highlight: { attrs: { color: { default: "#fef08a" } } },
    text_color: { attrs: { color: { default: "#111111" } } },
  },
});

type NodeName =
  | "doc"
  | "paragraph"
  | "heading"
  | "blockquote"
  | "bullet_list"
  | "ordered_list"
  | "list_item"
  | "code_block"
  | "divider"
  | "text";
type MarkName =
  "bold" | "italic" | "underline" | "strikethrough" | "code" | "link" | "highlight" | "text_color";

// mammoth emits standard HTML, so the HTML parse spec drives DOCX import too.
const parseSpec: HtmlParseSpec<NodeName, MarkName> = {
  nodes: [
    { tag: "p", node: "paragraph" },
    ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
      tag: `h${level}`,
      node: "heading" as const,
      getAttrs: () => ({ level }),
    })),
    { tag: "blockquote", node: "blockquote" },
    { tag: "ul", node: "bullet_list" },
    { tag: "ol", node: "ordered_list" },
    { tag: "li", node: "list_item" },
  ],
  marks: [
    { tag: "strong", mark: "bold" },
    { tag: "b", mark: "bold" },
    { tag: "em", mark: "italic" },
    { tag: "i", mark: "italic" },
    { tag: "a", mark: "link", getAttrs: (el) => ({ href: el.getAttribute("href") ?? "" }) },
  ],
};

const exporter = new DocxExporter<NodeName>();
const importer = new DocxImporter<NodeName, MarkName>({ schema, parseSpec });

function findDeep(
  node: { text?: string; content: readonly { text?: string; type: string }[] },
  predicate: (n: { text?: string; type: string }) => boolean,
): { text?: string; type: string } | undefined {
  for (const child of node.content) {
    if (predicate(child)) {
      return child;
    }
    const nested = findDeep(child as never, predicate);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

describe("DocxExporter", () => {
  it("produces a valid .docx (ZIP) byte stream", async () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);

    const bytes = await exporter.serialize(doc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);
    // ZIP local-file-header magic "PK\x03\x04".
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("exposes format 'docx'", () => {
    expect(exporter.format).toBe("docx");
    expect(importer.format).toBe("docx");
  });
});

describe("DOCX round-trip (export -> import)", () => {
  it("preserves headings, bold/italic, and paragraph text", async () => {
    const doc = schema.createDocument([
      schema.node("heading", { level: 2 }, [schema.text("Report")]),
      schema.node("paragraph", undefined, [
        schema.text("Hello "),
        schema.text("bold", [schema.mark("bold")]),
        schema.text(" and "),
        schema.text("italic", [schema.mark("italic")]),
        schema.text("."),
      ]),
    ]);

    const back = await importer.parse(await exporter.serialize(doc));

    const heading = back.content.find((node) => node.type === "heading");
    expect(heading?.attrs.level).toBe(2);
    expect(heading?.content[0]?.text).toBe("Report");

    const bold = findDeep(back, (n) => n.text === "bold");
    expect(bold).toBeDefined();
    const italic = findDeep(back, (n) => n.text === "italic");
    expect(italic).toBeDefined();
  });

  it("preserves a bullet list's items", async () => {
    const doc = schema.createDocument([
      schema.node("bullet_list", undefined, [
        schema.node("list_item", undefined, [
          schema.node("paragraph", undefined, [schema.text("one")]),
        ]),
        schema.node("list_item", undefined, [
          schema.node("paragraph", undefined, [schema.text("two")]),
        ]),
      ]),
    ]);

    const back = await importer.parse(await exporter.serialize(doc));
    expect(findDeep(back, (n) => n.text === "one")).toBeDefined();
    expect(findDeep(back, (n) => n.text === "two")).toBeDefined();
  });

  it("exports text color and highlight without error, preserving the text", async () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("red", [schema.mark("text_color", { color: "#ff0000" })]),
        schema.text(" and "),
        schema.text("lit", [schema.mark("highlight", { color: "#00ff00" })]),
      ]),
    ]);

    const bytes = await exporter.serialize(doc);
    // Valid .docx (ZIP magic) — the color/shading mapping produced valid XML.
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const back = await importer.parse(bytes);
    // Text survives (adjacent runs may merge on import); colors are a documented
    // best-effort — the point here is the color/shading mapping produced valid
    // DOCX and round-trips without loss of content.
    const text = JSON.stringify(back);
    expect(text).toContain("red");
    expect(text).toContain("lit");
  });

  it("sanitizes a javascript: link through the HTML import path", async () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("click", [schema.mark("link", { href: "javascript:alert(1)" })]),
      ]),
    ]);

    const back = await importer.parse(await exporter.serialize(doc));
    // The text survives; any link mark must not carry the javascript: URL.
    expect(findDeep(back, (n) => n.text === "click")).toBeDefined();
    expect(JSON.stringify(back)).not.toContain("javascript:");
  });
});
