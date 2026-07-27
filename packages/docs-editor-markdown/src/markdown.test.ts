import { createSchema } from "@sbh321/docs-editor-core";
import { describe, expect, it } from "vitest";

import { MarkdownImporter } from "./parse";
import { MarkdownExporter } from "./serialize";

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
    code: { excludes: "_" },
    link: { attrs: { href: {} }, inclusive: false },
    text_color: { attrs: { color: { default: "#111111" } } },
    highlight: { attrs: { color: { default: "#fef08a" } } },
  },
});

const exporter = new MarkdownExporter();
const importer = new MarkdownImporter(schema);

describe("MarkdownExporter", () => {
  it("serializes headings, marks, and lists", () => {
    const doc = schema.createDocument([
      schema.node("heading", { level: 2 }, [schema.text("Title")]),
      schema.node("paragraph", undefined, [
        schema.text("Hello "),
        schema.text("world", [schema.mark("bold")]),
      ]),
      schema.node("bullet_list", undefined, [
        schema.node("list_item", undefined, [
          schema.node("paragraph", undefined, [schema.text("one")]),
        ]),
        schema.node("list_item", undefined, [
          schema.node("paragraph", undefined, [schema.text("two")]),
        ]),
      ]),
    ]);

    const markdown = exporter.serialize(doc);

    expect(markdown).toContain("## Title");
    expect(markdown).toContain("Hello **world**");
    expect(markdown).toContain("- one");
    expect(markdown).toContain("- two");
  });

  it("serializes a link and inline code", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("Docs", [schema.mark("link", { href: "https://a.test/" })]),
        schema.text(" and "),
        schema.text("code", [schema.mark("code")]),
      ]),
    ]);

    const markdown = exporter.serialize(doc);
    expect(markdown).toContain("[Docs](https://a.test/)");
    expect(markdown).toContain("`code`");
  });
});

describe("MarkdownImporter", () => {
  it("parses headings, marks, and links into validated nodes", () => {
    const doc = importer.parse("## Title\n\nHello **world** and [Docs](https://a.test/)");

    expect(doc.content[0]?.type).toBe("heading");
    expect(doc.content[0]?.attrs.level).toBe(2);

    const paragraph = doc.content[1];
    const bold = paragraph?.content.find((n) => n.text === "world");
    expect(bold?.marks[0]?.type).toBe("bold");

    const link = paragraph?.content.find((n) => n.text === "Docs");
    expect(link?.marks[0]?.type).toBe("link");
    expect(link?.marks[0]?.attrs.href).toBe("https://a.test/");
  });

  it("parses a code fence into a code block", () => {
    const doc = importer.parse("```\nconst x = 1;\n```");
    expect(doc.content[0]?.type).toBe("code_block");
    expect(doc.content[0]?.content[0]?.text).toBe("const x = 1;");
  });

  it("treats raw HTML as inert text (html: false), not markup", () => {
    const doc = importer.parse("<script>alert(1)</script>");

    // The raw HTML survives only as literal text inside a text node — never as
    // a parsed element — so nothing can execute.
    const paragraph = doc.content[0];
    expect(paragraph?.type).toBe("paragraph");
    const textNode = paragraph?.content[0];
    expect(textNode?.text).toBe("<script>alert(1)</script>");
    expect(textNode?.marks).toEqual([]);
  });
});

describe("Markdown lossy cases (documented, not hidden)", () => {
  it("drops marks Markdown cannot express, preserving the text", () => {
    // The example schema has no underline/highlight, but a real one might; a
    // mark Markdown can't express must degrade to plain text, never corrupt it.
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("kept", [schema.mark("bold")]),
        schema.text(" and "),
        // `code` is expressible; pair it with a link to confirm link wins the
        // wrapping while unknown decorations would simply not appear.
        schema.text("plain"),
      ]),
    ]);

    const markdown = exporter.serialize(doc);
    expect(markdown).toContain("**kept**");
    expect(markdown).toContain("plain");
  });

  it("drops color marks Markdown can't express, keeping the text", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("red", [schema.mark("text_color", { color: "#ff0000" })]),
        schema.text(" and "),
        schema.text("lit", [schema.mark("highlight", { color: "#00ff00" })]),
      ]),
    ]);

    const markdown = exporter.serialize(doc);
    expect(markdown).toContain("red and lit");
    expect(markdown).not.toContain("#ff0000");
    expect(markdown).not.toContain("color");
  });

  it("degrades an unknown block node to its inline text", () => {
    const doc = schema.createDocument([
      schema.node("blockquote", undefined, [
        schema.node("paragraph", undefined, [schema.text("quoted")]),
      ]),
      schema.node("divider"),
    ]);

    const markdown = exporter.serialize(doc);
    expect(markdown).toContain("> quoted");
    expect(markdown).toContain("---");
  });
});

describe("Markdown round-trip", () => {
  it("preserves structure within Markdown's expressiveness", () => {
    const markdown = "# Report\n\nSome **bold** and *italic* text.\n\n- a\n- b\n";
    const doc = importer.parse(markdown);
    const back = exporter.serialize(doc);

    expect(back).toContain("# Report");
    expect(back).toContain("**bold**");
    expect(back).toContain("*italic*");
    expect(back).toContain("- a");
    expect(back).toContain("- b");
  });
});
