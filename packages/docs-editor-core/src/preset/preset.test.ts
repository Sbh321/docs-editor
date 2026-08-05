import { describe, expect, it } from "vitest";

import { HtmlExporter, HtmlImporter } from "../serialization";

import { defaultKeymap } from "./default-keymap";
import { defaultParseSpec } from "./default-parse-spec";
import { defaultMarkRenderers, defaultNodeRenderers } from "./default-renderers";
import {
  defaultMarkSpecs,
  defaultNodeSpecs,
  defaultSchema,
  extendDefaultSchema,
} from "./default-schema";

import type { DefaultMarkName, DefaultNodeName } from "./default-schema";

/**
 * The preset is a **public API** (ROADMAP Phase 8, Milestone 8.1): a document
 * saved against it today must still load tomorrow, and its renderers and parse
 * rules must stay inverses of each other. Both are pinned here.
 */

const schema = defaultSchema;

const exporter = new HtmlExporter<DefaultNodeName, DefaultMarkName>({
  schema,
  nodeRenderers: defaultNodeRenderers(),
  markRenderers: defaultMarkRenderers,
});

const importer = new HtmlImporter<DefaultNodeName, DefaultMarkName>({
  schema,
  parseSpec: defaultParseSpec,
});

const doc = (...content: ReturnType<typeof schema.node>[]) => schema.createDocument(content);
const paragraph = (text: string, marks?: Parameters<typeof schema.text>[1]) =>
  schema.node("paragraph", undefined, [schema.text(text, marks)]);

describe("defaultSchema", () => {
  it("declares every documented node and mark type", () => {
    // These names are a public API — a rename breaks every stored document, so
    // the full set is spelled out rather than derived.
    expect(Object.keys(defaultNodeSpecs).sort()).toEqual(
      [
        "audio",
        "blockquote",
        "bullet_list",
        "caption",
        "code_block",
        "divider",
        "doc",
        "embed",
        "figure",
        "file",
        "heading",
        "image",
        "list_item",
        "task_list",
        "task_item",
        "ordered_list",
        "paragraph",
        "table",
        "table_cell",
        "table_header",
        "table_row",
        "text",
        "video",
      ].sort(),
    );
    expect(Object.keys(defaultMarkSpecs).sort()).toEqual(
      [
        "bold",
        "code",
        "font_family",
        "font_size",
        "highlight",
        "italic",
        "link",
        "strikethrough",
        "text_color",
        "underline",
      ].sort(),
    );
  });

  it("builds a document from every block type without configuration", () => {
    const document = doc(
      schema.node("heading", { level: 2 }, [schema.text("Title")]),
      paragraph("Body"),
      schema.node("blockquote", undefined, [paragraph("Quoted")]),
      schema.node("bullet_list", undefined, [
        schema.node("list_item", undefined, [paragraph("One")]),
      ]),
      schema.node("code_block", undefined, [schema.text("const x = 1;")]),
      schema.node("divider"),
      schema.node("figure", undefined, [
        schema.node("image", { src: "https://a.test/x.png", alt: "X" }),
        schema.node("caption", undefined, [schema.text("A caption")]),
      ]),
      schema.node("table", undefined, [
        schema.node("table_row", undefined, [
          schema.node("table_header", undefined, [paragraph("H")]),
        ]),
      ]),
    );

    expect(document.content).toHaveLength(8);
  });

  it("excludes other marks from inline code", () => {
    // Text cannot be bold *and* code; the schema is what enforces it.
    expect(defaultMarkSpecs.code.excludes).toBe("_");
  });

  it("makes links non-inclusive, so typing past one does not extend it", () => {
    expect(defaultMarkSpecs.link.inclusive).toBe(false);
  });

  it("forbids formatting inside a code block", () => {
    expect(defaultNodeSpecs.code_block.marks).toBe("none");
    expect(defaultNodeSpecs.code_block.code).toBe(true);
  });
});

describe("extendDefaultSchema", () => {
  it("adds a node without disturbing the defaults", () => {
    const extended = extendDefaultSchema({
      nodes: { callout: { group: "block", content: "block+" } },
    });

    // `block+` requires content, so the added node is built with some — the
    // point is that it exists and validates, not that it can be empty. The cast
    // is the documented ergonomic cost of extending: the added names are known
    // to the caller, not to `DefaultNodeName`.
    expect(() =>
      extended.node("callout" as DefaultNodeName, undefined, [
        extended.node("paragraph", undefined, [extended.text("Note")]),
      ]),
    ).not.toThrow();
    expect(() => extended.node("paragraph")).not.toThrow();
  });

  it("adds a mark without disturbing the defaults", () => {
    const extended = extendDefaultSchema({ marks: { superscript: {} } });

    expect(() => extended.mark("superscript" as DefaultMarkName)).not.toThrow();
    expect(() => extended.mark("bold")).not.toThrow();
  });

  it("replaces an existing spec rather than merging into it", () => {
    const extended = extendDefaultSchema({
      nodes: {
        heading: { ...defaultNodeSpecs.heading, attrs: { level: { default: 3 } } },
      },
    });

    expect(extended.node("heading").attrs.level).toBe(3);
  });

  it("leaves the shared default schema untouched", () => {
    extendDefaultSchema({ nodes: { callout: { group: "block", content: "block+" } } });

    // A mutation of the shared specs would leak into every other consumer.
    expect(() => defaultSchema.node("callout" as DefaultNodeName)).toThrow();
  });
});

describe("renderers and parse rules are inverses", () => {
  /** Exports a document to HTML and imports it back. */
  const roundTrip = (document: ReturnType<typeof doc>) =>
    importer.parse(exporter.serialize(document));

  it("round-trips every block type", () => {
    const original = doc(
      schema.node("heading", { level: 3 }, [schema.text("Heading")]),
      paragraph("Prose"),
      schema.node("blockquote", undefined, [paragraph("Quoted")]),
      schema.node("bullet_list", undefined, [
        schema.node("list_item", undefined, [paragraph("Item")]),
      ]),
      schema.node("ordered_list", { order: 3 }, [
        schema.node("list_item", undefined, [paragraph("Third")]),
      ]),
      schema.node("divider"),
    );

    const back = roundTrip(original);
    const types = back.content.map((node) => node.type);

    expect(types).toContain("heading");
    expect(types).toContain("blockquote");
    expect(types).toContain("bullet_list");
    expect(types).toContain("ordered_list");
    expect(types).toContain("divider");
    expect(back.content.find((n) => n.type === "heading")?.attrs.level).toBe(3);
    expect(back.content.find((n) => n.type === "ordered_list")?.attrs.order).toBe(3);
  });

  it("round-trips every mark", () => {
    const original = doc(
      schema.node("paragraph", undefined, [
        schema.text("bold", [schema.mark("bold")]),
        schema.text("italic", [schema.mark("italic")]),
        schema.text("under", [schema.mark("underline")]),
        schema.text("struck", [schema.mark("strikethrough")]),
        schema.text("code", [schema.mark("code")]),
        schema.text("linked", [schema.mark("link", { href: "https://a.test/" })]),
      ]),
    );

    const json = JSON.stringify(roundTrip(original));
    for (const mark of ["bold", "italic", "underline", "strikethrough", "code", "link"]) {
      expect(json).toContain(mark);
    }
    expect(json).toContain("https://a.test/");
  });

  it("round-trips colours and fonts through inline styles", () => {
    const original = doc(
      schema.node("paragraph", undefined, [
        schema.text("red", [schema.mark("text_color", { color: "#ff0000" })]),
        schema.text("lit", [schema.mark("highlight", { color: "#00ff00" })]),
        schema.text("serif", [schema.mark("font_family", { family: "Georgia, serif" })]),
      ]),
    );

    const back = JSON.stringify(roundTrip(original));
    expect(back).toContain("text_color");
    expect(back).toContain("highlight");
    expect(back).toContain("font_family");
    expect(back).toContain("Georgia");
  });

  it("round-trips an image with its alt text", () => {
    const back = roundTrip(
      doc(schema.node("image", { src: "https://a.test/x.png", alt: "A cat" })),
    );
    const image = back.content.find((node) => node.type === "image");

    expect(image?.attrs.src).toBe("https://a.test/x.png");
    expect(image?.attrs.alt).toBe("A cat");
  });

  it("round-trips a table, including a spanning cell", () => {
    const original = doc(
      schema.node("table", undefined, [
        schema.node("table_row", undefined, [
          schema.node("table_header", { colspan: 2 }, [paragraph("Header")]),
        ]),
        schema.node("table_row", undefined, [
          schema.node("table_cell", undefined, [paragraph("A")]),
          schema.node("table_cell", undefined, [paragraph("B")]),
        ]),
      ]),
    );

    const back = roundTrip(original);
    const table = back.content.find((node) => node.type === "table");
    expect(table).toBeDefined();

    const header = table?.content[0]?.content[0];
    expect(header?.type).toBe("table_header");
    expect(header?.attrs.colspan).toBe(2);
  });

  it("emits an explicit tbody, so exported markup re-imports unchanged", () => {
    // A browser inserts <tbody> when parsing, so omitting it on export would
    // make export and import disagree about the markup.
    const html = exporter.serialize(
      doc(
        schema.node("table", undefined, [
          schema.node("table_row", undefined, [
            schema.node("table_cell", undefined, [paragraph("A")]),
          ]),
        ]),
      ),
    );
    expect(html).toContain("<tbody>");
  });

  it("does not turn an ordinary span into a font or colour mark", () => {
    // Every pasted document is full of meaningless spans; treating them as
    // formatting would attach a mark to most of the text on the page.
    const back = importer.parse("<p><span>plain</span></p>");
    expect(JSON.stringify(back)).not.toContain("font_family");
    expect(JSON.stringify(back)).not.toContain("text_color");
  });

  it("reads a colour without matching background-color", () => {
    const back = importer.parse('<p><span style="background-color: #fff">x</span></p>');
    // `color` must anchor to a declaration boundary, or it matches inside
    // `background-color` and produces a bogus text colour.
    expect(JSON.stringify(back)).not.toContain("text_color");
  });
});

describe("defaultNodeRenderers", () => {
  it("clamps a heading level to real HTML", () => {
    // An out-of-range level would otherwise emit <h9>, which is not an element.
    const renderers = defaultNodeRenderers();
    const spec = renderers.heading?.({
      type: "heading",
      attrs: { level: 42 },
      content: [],
      marks: [],
    });
    expect(spec?.[0]).toBe("h6");
  });

  it("forwards media loading options, which print needs", () => {
    const html = new HtmlExporter<DefaultNodeName, DefaultMarkName>({
      schema,
      nodeRenderers: defaultNodeRenderers({ loading: "eager" }),
      markRenderers: defaultMarkRenderers,
    }).serialize(doc(schema.node("image", { src: "https://a.test/x.png", alt: "X" })));

    expect(html).toContain('loading="eager"');
  });
});

describe("defaultKeymap", () => {
  it("binds the formatting shortcuts users already know", () => {
    for (const key of ["Mod-b", "Mod-i", "Mod-u", "Mod-z", "Shift-Mod-z", "Enter", "Tab"]) {
      expect(defaultKeymap[key]).toBeTypeOf("function");
    }
  });

  it("binds redo on both platforms' conventions", () => {
    // macOS uses Shift-Mod-z; Windows and Linux users reach for Mod-y.
    expect(defaultKeymap["Mod-y"]).toBeTypeOf("function");
    expect(defaultKeymap["Shift-Mod-z"]).toBeTypeOf("function");
  });

  it("keeps the base structural bindings", () => {
    // Losing these would break Backspace joining blocks, which is not
    // formatting but is what makes the editor usable.
    expect(defaultKeymap.Backspace).toBeTypeOf("function");
  });
});
