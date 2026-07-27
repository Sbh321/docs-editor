import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { defaultPrintStylesheet, PrintExporter } from "./print";

import type { FixtureMarkName, FixtureNodeName } from "../schema/schema.fixtures";

const schema = createFixtureSchema();

const nodeRenderers = {
  paragraph: () => ["p", 0] as const,
  heading: (node: { attrs: Record<string, unknown> }) =>
    [`h${Number(node.attrs.level) || 1}`, 0] as const,
};

function exporter(options?: { title?: string; lang?: string; stylesheet?: string }) {
  return new PrintExporter<FixtureNodeName, FixtureMarkName>({
    schema,
    nodeRenderers,
    ...options,
  });
}

const sampleDoc = () =>
  schema.createDocument([
    schema.node("heading", { level: 1 }, [schema.text("Report")]),
    schema.node("paragraph", undefined, [schema.text("Body text.")]),
  ]);

describe("PrintExporter", () => {
  it("produces a complete standalone HTML document wrapping the body", () => {
    const html = exporter().serialize(sampleDoc());

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<main class="docs-editor-print">');
    expect(html).toContain("<h1>Report</h1>");
    expect(html).toContain("<p>Body text.</p>");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("embeds the default print stylesheet", () => {
    const html = exporter().serialize(sampleDoc());

    expect(html).toContain("<style>");
    expect(html).toContain("@page");
    expect(html).toContain(".docs-editor-print");
  });

  it("uses a custom title and lang, escaping the title", () => {
    const html = exporter({ title: "Q3 <Financials>", lang: "fr" }).serialize(sampleDoc());

    expect(html).toContain('<html lang="fr">');
    expect(html).toContain("<title>Q3 &lt;Financials&gt;</title>");
    expect(html).not.toContain("<title>Q3 <Financials></title>");
  });

  it("accepts a custom stylesheet that replaces the default", () => {
    const html = exporter({ stylesheet: "body { color: red; }" }).serialize(sampleDoc());

    expect(html).toContain("<style>body { color: red; }</style>");
    expect(html).not.toContain("@page");
  });

  it("exposes format 'print'", () => {
    expect(exporter().format).toBe("print");
  });

  it("ships a non-empty default print stylesheet with pagination rules", () => {
    expect(defaultPrintStylesheet).toContain("break-inside: avoid");
    expect(defaultPrintStylesheet).toContain("orphans");
  });
});

describe("PrintExporter page layout", () => {
  it("emits an @page rule for A4 portrait with the given margins", () => {
    const html = new PrintExporter<FixtureNodeName, FixtureMarkName>({
      schema,
      nodeRenderers,
      pageLayout: {
        size: "A4",
        orientation: "portrait",
        margins: { top: 1, right: 1, bottom: 1, left: 1, unit: "in" },
      },
    }).serialize(sampleDoc());

    expect(html).toContain("@page { size: 210mm 297mm; margin: 1in 1in 1in 1in; }");
  });

  it("swaps dimensions for landscape", () => {
    const html = new PrintExporter<FixtureNodeName, FixtureMarkName>({
      schema,
      nodeRenderers,
      pageLayout: {
        size: "Letter",
        orientation: "landscape",
        margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5, unit: "in" },
      },
    }).serialize(sampleDoc());

    expect(html).toContain("size: 11in 8.5in");
  });

  it("renders the running header and footer", () => {
    const html = new PrintExporter<FixtureNodeName, FixtureMarkName>({
      schema,
      nodeRenderers,
      pageLayout: {
        size: "A4",
        orientation: "portrait",
        margins: { top: 1, right: 1, bottom: 1, left: 1, unit: "in" },
        header: "My Report",
        footer: "Confidential",
        showPageNumbers: true,
      },
    }).serialize(sampleDoc());

    expect(html).toContain("docs-editor-print-header");
    expect(html).toContain("My Report");
    expect(html).toContain("docs-editor-print-footer");
    expect(html).toContain("Confidential · Page");
  });

  it("omits the sized @page rule and running header/footer when no layout is given", () => {
    const html = exporter().serialize(sampleDoc());
    // The default stylesheet has a plain `@page { margin }`, but no size-driven
    // page rule and no running header/footer.
    expect(html).not.toContain("size: 210mm");
    expect(html).not.toContain("docs-editor-print-running");
  });
});
