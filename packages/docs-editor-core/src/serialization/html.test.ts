import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { HtmlExporter } from "./html";

import type { FixtureMarkName, FixtureNodeName } from "../schema/schema.fixtures";

const schema = createFixtureSchema();

const nodeRenderers = {
  paragraph: () => ["p", 0] as const,
  heading: (node: { attrs: Record<string, unknown> }) =>
    [`h${Number(node.attrs.level) || 1}`, 0] as const,
  blockquote: () => ["blockquote", 0] as const,
  divider: () => ["hr"] as const,
};

const markRenderers = {
  bold: () => ["strong", 0] as const,
  link: (mark: { attrs: Record<string, unknown> }) =>
    ["a", { href: String(mark.attrs.href) }, 0] as const,
};

function exporter() {
  return new HtmlExporter<FixtureNodeName, FixtureMarkName>({
    schema,
    nodeRenderers,
    markRenderers,
  });
}

describe("HtmlExporter", () => {
  it("serializes nodes and marks to semantic HTML matching the renderers", () => {
    const doc = schema.createDocument([
      schema.node("heading", { level: 2 }, [schema.text("Title")]),
      schema.node("paragraph", undefined, [
        schema.text("Hello "),
        schema.text("world", [schema.mark("bold")]),
      ]),
    ]);

    const html = exporter().serialize(doc);

    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain("<p>Hello <strong>world</strong></p>");
  });

  it("renders an attribute-carrying mark (link href)", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("Docs", [schema.mark("link", { href: "https://a.test/" })]),
      ]),
    ]);

    expect(exporter().serialize(doc)).toContain('<a href="https://a.test/">Docs</a>');
  });

  it("renders a leaf node (divider) with no content", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("x")]),
      schema.node("divider"),
    ]);

    expect(exporter().serialize(doc)).toContain("<hr>");
  });

  it("escapes injection-shaped attribute values", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("x", [schema.mark("link", { href: '"><script>alert(1)</script>' })]),
      ]),
    ]);

    const html = exporter().serialize(doc);
    // The quote is escaped, so the value can't break out of the attribute —
    // no `"><script` breakout sequence, and the quote appears as `&quot;`.
    expect(html).toContain("&quot;");
    expect(html).not.toContain('"><script');
  });

  it("exposes format 'html'", () => {
    expect(exporter().format).toBe("html");
  });
});
