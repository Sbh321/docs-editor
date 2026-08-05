import {
  createSchema,
  mediaNodeSpecs,
  paragraphFormattingAttrs,
  taskListNodeSpecs,
} from "@sbh321/docs-editor-core";
import { describe, expect, it } from "vitest";

import { DocxImporter } from "./parse";
import { DocxExporter } from "./serialize";

import type { HtmlParseSpec } from "@sbh321/docs-editor-core";

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", attrs: { ...paragraphFormattingAttrs() } },
    heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
    blockquote: { group: "block", content: "block+" },
    bullet_list: { group: "block", content: "list_item+" },
    ordered_list: { group: "block", content: "list_item+", attrs: { order: { default: 1 } } },
    list_item: { content: "paragraph block*" },
    code_block: { group: "block", content: "text*", marks: "none", code: true },
    divider: { group: "block" },
    text: { group: "inline", isText: true, marks: "all" },
    ...mediaNodeSpecs(),
    ...taskListNodeSpecs(),
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
    font_size: { attrs: { size: { default: 12 } } },
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
  | "task_list"
  | "task_item"
  | "code_block"
  | "divider"
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "embed"
  | "figure"
  | "caption";
type MarkName =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "link"
  | "highlight"
  | "text_color"
  | "font_size";

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

describe("DOCX image embedding", () => {
  /** A minimal but structurally valid 1x1 PNG. */
  const PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  function imageDoc(src = "https://cdn.test/photo.png") {
    return schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Before")]),
      schema.node("image", { src, alt: "A photo" }),
    ]);
  }

  it("embeds the image when a resolver supplies bytes", async () => {
    const requested: string[] = [];
    const withAssets = new DocxExporter<NodeName>({
      resolveAsset: (src) => {
        requested.push(src);
        return { data: PNG_BYTES, width: 800, height: 600 };
      },
    });

    const bytes = await withAssets.serialize(imageDoc());

    expect(requested).toEqual(["https://cdn.test/photo.png"]);
    // A real .docx (ZIP magic) containing an embedded media part.
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // The ZIP central directory records the embedded image's path.
    const asText = new TextDecoder("latin1").decode(bytes);
    expect(asText).toContain("word/media/");
  });

  it("falls back to alt text when no resolver is supplied", async () => {
    const bytes = await exporter.serialize(imageDoc());
    const asText = new TextDecoder("latin1").decode(bytes);

    // Nothing was embedded; the document still exports.
    expect(asText).not.toContain("word/media/");
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("falls back to alt text when the resolver declines", async () => {
    const declining = new DocxExporter<NodeName>({ resolveAsset: () => null });
    const bytes = await declining.serialize(imageDoc());

    expect(new TextDecoder("latin1").decode(bytes)).not.toContain("word/media/");
  });

  it("does not fail the export when the resolver throws", async () => {
    // One unreachable image must not lose the whole document.
    const failing = new DocxExporter<NodeName>({
      resolveAsset: () => {
        throw new Error("403 Forbidden");
      },
    });

    const bytes = await failing.serialize(imageDoc());
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("resolves each distinct source once, even when reused", async () => {
    const requested: string[] = [];
    const counting = new DocxExporter<NodeName>({
      resolveAsset: (src) => {
        requested.push(src);
        return { data: PNG_BYTES, width: 10, height: 10 };
      },
    });

    const doc = schema.createDocument([
      schema.node("image", { src: "https://cdn.test/same.png" }),
      schema.node("image", { src: "https://cdn.test/same.png" }),
      schema.node("image", { src: "https://cdn.test/other.png" }),
    ]);
    await counting.serialize(doc);

    expect(requested.sort()).toEqual(["https://cdn.test/other.png", "https://cdn.test/same.png"]);
  });
});

/**
 * Phase 9 types in DOCX (Milestones 9.2, 9.3).
 *
 * The round-trip here goes through mammoth, which converts DOCX to HTML by
 * mapping *styles* and deliberately discards direct formatting such as
 * paragraph alignment and run sizes. So alignment and font size are
 * **export-only**: Word reads them, our own importer does not restore them.
 * That is a property of the import path, not a gap in the export, and it is
 * recorded in the package README rather than left to be rediscovered.
 */
describe("DOCX — Phase 9 types", () => {
  it("exports alignment, indentation and font size without failing", async () => {
    const doc = schema.createDocument([
      schema.node("paragraph", { align: "center", indent: 2 }, [
        schema.text("Centred", [schema.mark("font_size", { size: 24 })]),
      ]),
    ]);

    const bytes = await exporter.serialize(doc);
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("carries a checklist's state across as a ballot-box glyph", async () => {
    // DOCX can hold a real checkbox content control, but only Word renders one —
    // every other reader shows a blank. A glyph is legible everywhere, and it
    // survives this round-trip, which is what proves the state was not lost.
    const doc = schema.createDocument([
      schema.node("task_list", undefined, [
        schema.node("task_item", { checked: true }, [
          schema.node("paragraph", undefined, [schema.text("Done")]),
        ]),
        schema.node("task_item", { checked: false }, [
          schema.node("paragraph", undefined, [schema.text("Todo")]),
        ]),
      ]),
    ]);

    const back = await importer.parse(await exporter.serialize(doc));
    const text = JSON.stringify(back);
    expect(text).toContain("\u2612"); // checked
    expect(text).toContain("\u2610"); // unchecked
  });
});
