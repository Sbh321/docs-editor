import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { HtmlExporter, HtmlImporter } from "./html";

import type { HtmlParseSpec } from "../dom-parse-spec";
import type { FixtureMarkName, FixtureNodeName } from "../schema/schema.fixtures";

const schema = createFixtureSchema();

const parseSpec: HtmlParseSpec<FixtureNodeName, FixtureMarkName> = {
  nodes: [
    { tag: "p", node: "paragraph" },
    { tag: "h1", node: "heading", getAttrs: () => ({ level: 1 }) },
    { tag: "h2", node: "heading", getAttrs: () => ({ level: 2 }) },
    { tag: "blockquote", node: "blockquote" },
    { tag: "hr", node: "divider" },
  ],
  marks: [
    { tag: "strong", mark: "bold" },
    { tag: "b", mark: "bold" },
    { tag: "a", mark: "link", getAttrs: (el) => ({ href: el.getAttribute("href") ?? "" }) },
  ],
};

function importer() {
  return new HtmlImporter<FixtureNodeName, FixtureMarkName>({ schema, parseSpec });
}

describe("HtmlImporter", () => {
  it("parses tags into nodes and marks", () => {
    const doc = importer().parse("<h2>Title</h2><p>Hello <strong>world</strong></p>");

    expect(doc.content[0]?.type).toBe("heading");
    expect(doc.content[0]?.attrs.level).toBe(2);
    expect(doc.content[0]?.content[0]?.text).toBe("Title");

    const paragraph = doc.content[1];
    expect(paragraph?.type).toBe("paragraph");
    const bold = paragraph?.content.find((n) => n.text === "world");
    expect(bold?.marks[0]?.type).toBe("bold");
  });

  it("carries a link's href through getAttrs", () => {
    const doc = importer().parse('<p><a href="https://a.test/">Docs</a></p>');
    const link = doc.content[0]?.content[0];
    expect(link?.marks[0]?.type).toBe("link");
    expect(link?.marks[0]?.attrs.href).toBe("https://a.test/");
  });

  it("never carries a script — it is stripped, not executed", () => {
    const doc = importer().parse("<p>safe</p><script>window.__pwned = true</script>");
    const text = JSON.stringify(doc);
    expect(text).not.toContain("__pwned");
    expect(text).not.toContain("<script");
  });

  it("strips a javascript: URL from a link", () => {
    const doc = importer().parse('<p><a href="javascript:alert(1)">x</a></p>');
    const inline = doc.content[0]?.content[0];
    // The link mark, if applied, must not carry the javascript: URL.
    const href = inline?.marks[0]?.attrs.href;
    expect(href).not.toContain("javascript:");
  });

  it("round-trips through export -> import within the schema's features", () => {
    const original = schema.createDocument([
      schema.node("heading", { level: 1 }, [schema.text("Report")]),
      schema.node("paragraph", undefined, [
        schema.text("Bold ", [schema.mark("bold")]),
        schema.text("text."),
      ]),
    ]);

    const html = new HtmlExporter<FixtureNodeName, FixtureMarkName>({
      schema,
      nodeRenderers: {
        paragraph: () => ["p", 0],
        heading: (node) => [`h${Number(node.attrs.level) || 1}`, 0],
      },
      markRenderers: { bold: () => ["strong", 0] },
    }).serialize(original);

    const back = importer().parse(html);

    expect(back.content[0]?.type).toBe("heading");
    expect(back.content[0]?.attrs.level).toBe(1);
    expect(back.content[1]?.content[0]?.marks[0]?.type).toBe("bold");
  });
});
