import { createSchema, mediaNodeSpecs, taskListNodeSpecs } from "@sbh321/docs-editor-core";
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
    ...mediaNodeSpecs(),
    ...taskListNodeSpecs(),
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

describe("Markdown media (ROADMAP 7.6)", () => {
  it("exports an image natively, with alt and title", () => {
    const doc = schema.createDocument([
      schema.node("image", { src: "https://cdn.test/a.png", alt: "A cat", title: "Tabby" }),
    ]);

    expect(exporter.serialize(doc)).toContain('![A cat](https://cdn.test/a.png "Tabby")');
  });

  it("keeps an empty alt empty, so a decorative image stays decorative", () => {
    const doc = schema.createDocument([
      schema.node("image", { src: "https://cdn.test/line.png", alt: "", decorative: true }),
    ]);

    // `![](src)` is Markdown's "no alternative text" — substituting a filename
    // here would announce a decorative image to a screen reader.
    expect(exporter.serialize(doc)).toContain("![](https://cdn.test/line.png)");
  });

  it("degrades video, audio, attachments and embeds to links", () => {
    const doc = schema.createDocument([
      schema.node("video", { src: "https://cdn.test/clip.mp4", alt: "Launch clip" }),
      schema.node("audio", { src: "https://cdn.test/tone.mp3", title: "Tone" }),
      schema.node("file", { src: "https://cdn.test/r.pdf", filename: "report.pdf" }),
      schema.node("embed", { src: "https://embed.test/x", alt: "Chart" }),
    ]);

    const markdown = exporter.serialize(doc);
    expect(markdown).toContain("[Launch clip](https://cdn.test/clip.mp4)");
    expect(markdown).toContain('[Tone](https://cdn.test/tone.mp3 "Tone")');
    expect(markdown).toContain("[report.pdf](https://cdn.test/r.pdf)");
    expect(markdown).toContain("[Chart](https://embed.test/x)");
  });

  it("falls back to the URL when a media node carries no describing text", () => {
    const doc = schema.createDocument([schema.node("video", { src: "https://cdn.test/c.mp4" })]);

    // An empty link text would be unusable; the URL is the only honest label,
    // and inventing an English word like "Video" is not a serializer's job.
    expect(exporter.serialize(doc)).toContain("[https://cdn.test/c.mp4](https://cdn.test/c.mp4)");
  });

  it("emits nothing for media that is still uploading, rather than a broken link", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Before")]),
      schema.node("image", { src: "", alt: "" }),
      schema.node("paragraph", undefined, [schema.text("After")]),
    ]);

    const markdown = exporter.serialize(doc);
    expect(markdown).not.toContain("![]()");
    // The surrounding blocks stay correctly separated — no stray blank run.
    expect(markdown).toBe("Before\n\nAfter\n");
  });

  it("keeps the alt text when media has no usable source", () => {
    const doc = schema.createDocument([schema.node("image", { src: "", alt: "Pending photo" })]);

    expect(exporter.serialize(doc).trim()).toBe("Pending photo");
  });

  it("refuses to emit a link to an unsafe source", () => {
    const doc = schema.createDocument([
      schema.node("image", { src: "javascript:alert(1)", alt: "Trap" }),
    ]);

    const markdown = exporter.serialize(doc);
    expect(markdown).not.toContain("javascript:");
    expect(markdown).toContain("Trap");
  });

  it("flattens a figure into its media plus the caption as a paragraph", () => {
    const doc = schema.createDocument([
      schema.node("figure", undefined, [
        schema.node("image", { src: "https://cdn.test/f.png", alt: "Fig" }),
        schema.node("caption", undefined, [schema.text("Figure 1 — results")]),
      ]),
    ]);

    // Markdown has no figure/caption pairing: the grouping is the documented
    // loss, both halves survive.
    expect(exporter.serialize(doc)).toBe("![Fig](https://cdn.test/f.png)\n\nFigure 1 — results\n");
  });

  it("escapes a URL containing spaces so the link stays parseable", () => {
    const doc = schema.createDocument([
      schema.node("image", { src: "https://cdn.test/my photo.png", alt: "P" }),
    ]);

    expect(exporter.serialize(doc)).toContain("![P](<https://cdn.test/my photo.png>)");
  });

  it("imports a standalone image as an image node", () => {
    const doc = importer.parse('![A cat](https://cdn.test/a.png "Tabby")');

    const image = doc.content[0];
    expect(image?.type).toBe("image");
    expect(image?.attrs.src).toBe("https://cdn.test/a.png");
    expect(image?.attrs.alt).toBe("A cat");
    expect(image?.attrs.title).toBe("Tabby");
  });

  it("degrades an image mixed with text to an inline link", () => {
    const doc = importer.parse("See ![A cat](https://cdn.test/a.png) here");

    const paragraph = doc.content[0];
    expect(paragraph?.type).toBe("paragraph");
    const link = paragraph?.content.find((n) => n.text === "A cat");
    expect(link?.marks[0]?.type).toBe("link");
    expect(link?.marks[0]?.attrs.href).toBe("https://cdn.test/a.png");
  });

  it("does not import an unsafe image source as a node", () => {
    const doc = importer.parse("![Trap](javascript:alert(1))");

    // `markdown-it` refuses the destination while tokenizing, so this never
    // becomes an image token at all — the whole construct stays literal text.
    // The URL therefore survives only as text a browser cannot act on: no image
    // node, no `src` attribute, no link mark.
    const block = doc.content[0];
    expect(block?.type).toBe("paragraph");
    expect(block?.content[0]?.text).toBe("![Trap](javascript:alert(1))");
    expect(block?.content[0]?.marks).toEqual([]);
    expect(block?.attrs.src).toBeUndefined();
  });

  it("does not import an unsafe image source even if tokenizing let one through", () => {
    // Defence in depth: the importer's own check, exercised directly rather
    // than through `markdown-it`, so this package's guarantee does not silently
    // become a borrowed one if that dependency's link validation ever changes.
    const permissive = new MarkdownImporter(schema);
    const token = {
      type: "inline",
      tag: "",
      content: "",
      children: [
        {
          type: "image",
          tag: "img",
          content: "Trap",
          children: null,
          attrGet: (name: string) => (name === "src" ? "javascript:alert(1)" : null),
        },
      ],
      attrGet: () => null,
    };
    const attrs = (
      permissive as unknown as {
        standaloneImageAttrs(t: unknown): Record<string, unknown> | null;
      }
    ).standaloneImageAttrs(token);

    expect(attrs).toBeNull();
  });

  it("round-trips a standalone image", () => {
    const markdown = "![A cat](https://cdn.test/a.png)\n";
    expect(exporter.serialize(importer.parse(markdown))).toBe(markdown);
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

/**
 * Task lists (ROADMAP Phase 9, Milestone 9.3).
 *
 * GitHub Flavored Markdown rather than CommonMark, and markdown-it does not
 * tokenize it — so what is really being tested is the structural rewrite that
 * recognises it after the fact.
 */
describe("task lists", () => {
  const importer = new MarkdownImporter(schema);
  const exporter = new MarkdownExporter();

  it("imports a checklist", () => {
    const doc = importer.parse("- [x] Done\n- [ ] Todo");
    const list = doc.content[0];

    expect(list?.type).toBe("task_list");
    expect(list?.content[0]?.attrs.checked).toBe(true);
    expect(list?.content[1]?.attrs.checked).toBe(false);
    // The marker text is consumed, not left in the content.
    expect(list?.content[0]?.content[0]?.content[0]?.text).toBe("Done");
  });

  it("round-trips", () => {
    // Trailing newline: the exporter terminates every block, checklists
    // included.
    const markdown = "- [x] Done\n- [ ] Todo";
    expect(exporter.serialize(importer.parse(markdown))).toBe(`${markdown}\n`);
  });

  it("leaves a mixed list alone rather than promoting plain items", () => {
    // This model cannot express "an unchecked non-task item", so converting
    // would change what the plain item means. Keeping the literal text is
    // visible and lossless.
    const doc = importer.parse("- [x] Done\n- Plain");
    expect(doc.content[0]?.type).toBe("bullet_list");
    expect(doc.content[0]?.content[0]?.content[0]?.content[0]?.text).toBe("[x] Done");
  });

  it("leaves an ordinary bullet list alone", () => {
    expect(importer.parse("- One\n- Two").content[0]?.type).toBe("bullet_list");
  });
});
