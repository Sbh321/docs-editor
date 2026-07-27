import { marginsToCss, resolvePageDimensions, toCssLength } from "../page-layout";

import { HtmlExporter } from "./html";

import type { HtmlExporterOptions } from "./html";
import type { DocumentExporter } from "./types";
import type { PageLayout } from "../page-layout";
import type { DocumentNode } from "../schema";

export interface PrintExporterOptions<
  NodeName extends string = string,
  MarkName extends string = string,
> extends HtmlExporterOptions<NodeName, MarkName> {
  /** Document `<title>` (also usable as the print/PDF filename). Defaults to `"Document"`. */
  readonly title?: string;
  /** `lang` attribute on `<html>`. Defaults to `"en"`. */
  readonly lang?: string;
  /**
   * Print CSS embedded in the document `<head>`. Defaults to
   * {@link defaultPrintStylesheet}. Pass your own to fully control pagination
   * and typography; it replaces the default rather than extending it.
   */
  readonly stylesheet?: string;
  /**
   * Page setup for the printed output. When given, emits an `@page` rule for the
   * size/orientation/margins and renders the running header/footer on every
   * printed page. Omit for a simple, browser-default page.
   *
   * Note: automatic page *numbers* in the printed output depend on the browser
   * — most support the print dialog's own "headers and footers" option, but not
   * CSS page counters. The on-screen paginated view is where page numbers are
   * rendered deterministically.
   */
  readonly pageLayout?: PageLayout;
}

/**
 * The `"print"` {@link DocumentExporter} — serializes a {@link DocumentNode} to
 * a **complete, standalone HTML document** with an embedded print stylesheet,
 * suitable for `window.print()` (browser print-to-PDF) or opening as a clean,
 * pagination-friendly report.
 *
 * It reuses {@link HtmlExporter} for the body, so exported markup matches the
 * view's renderers, then wraps it in `<!doctype html>` with print CSS. Because
 * the markup is generated from the model, it carries no editor chrome — there
 * is nothing to hide. HTML *import* remains a separate, sanitized concern.
 */
export class PrintExporter<
  NodeName extends string = string,
  MarkName extends string = string,
> implements DocumentExporter<NodeName> {
  readonly format = "print";

  private readonly html: HtmlExporter<NodeName, MarkName>;
  private readonly title: string;
  private readonly lang: string;
  private readonly stylesheet: string;
  private readonly pageLayout: PageLayout | undefined;

  constructor(private readonly options: PrintExporterOptions<NodeName, MarkName>) {
    this.html = new HtmlExporter(options);
    this.title = options.title ?? "Document";
    this.lang = options.lang ?? "en";
    this.stylesheet = options.stylesheet ?? defaultPrintStylesheet;
    this.pageLayout = options.pageLayout;
  }

  serialize(doc: DocumentNode<NodeName>): string {
    const body = this.html.serialize(doc);
    const layoutCss = this.pageLayout ? pageLayoutCss(this.pageLayout) : "";
    const runningMarkup = this.pageLayout ? runningHeaderFooter(this.pageLayout) : "";
    return [
      "<!doctype html>",
      `<html lang="${escapeHtmlAttribute(this.lang)}">`,
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${escapeHtmlText(this.title)}</title>`,
      `<style>${this.stylesheet}${layoutCss}</style>`,
      "</head>",
      "<body>",
      runningMarkup,
      `<main class="docs-editor-print">${body}</main>`,
      "</body>",
      "</html>",
    ].join("\n");
  }
}

/** The `@page` rule and header/footer positioning for a {@link PageLayout}. */
function pageLayoutCss(layout: PageLayout): string {
  const { width, height, unit } = resolvePageDimensions(layout.size, layout.orientation);
  const size = `${toCssLength(width, unit)} ${toCssLength(height, unit)}`;
  return `
@page { size: ${size}; margin: ${marginsToCss(layout.margins)}; }
.docs-editor-print { max-width: none; margin: 0; padding: 0; }
.docs-editor-print-running {
  position: fixed;
  left: 0;
  right: 0;
  font-size: 9pt;
  color: #555;
  text-align: center;
}
.docs-editor-print-header { top: 0; }
.docs-editor-print-footer { bottom: 0; }
`;
}

/**
 * The running header/footer elements — `position: fixed`, which browsers repeat
 * on every printed page. Empty when the layout defines neither.
 */
function runningHeaderFooter(layout: PageLayout): string {
  const parts: string[] = [];
  if (layout.header) {
    parts.push(
      `<div class="docs-editor-print-running docs-editor-print-header">${escapeHtmlText(layout.header)}</div>`,
    );
  }
  const footerText = [layout.footer, layout.showPageNumbers ? "Page" : undefined]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  if (footerText) {
    parts.push(
      `<div class="docs-editor-print-running docs-editor-print-footer">${escapeHtmlText(footerText)}</div>`,
    );
  }
  return parts.join("\n");
}

/**
 * A professional, dependency-free print stylesheet: readable typography, sane
 * page margins, and pagination rules (avoid breaking inside media/tables, keep
 * headings with their content, control orphans/widows) so documents print — and
 * browser-print-to-PDF — as clean reports.
 */
export const defaultPrintStylesheet = `
:root { color-scheme: light; }
@page { margin: 2cm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  color: #111;
  background: #fff;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 12pt;
  line-height: 1.6;
}
.docs-editor-print {
  max-width: 45rem;
  margin: 0 auto;
  padding: 1rem;
}
.docs-editor-print h1,
.docs-editor-print h2,
.docs-editor-print h3,
.docs-editor-print h4,
.docs-editor-print h5,
.docs-editor-print h6 {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.25;
  break-after: avoid-page;
  break-inside: avoid;
}
.docs-editor-print h1 { font-size: 2em; }
.docs-editor-print h2 { font-size: 1.5em; }
.docs-editor-print h3 { font-size: 1.25em; }
.docs-editor-print p,
.docs-editor-print li,
.docs-editor-print blockquote { orphans: 3; widows: 3; }
.docs-editor-print img { max-width: 100%; height: auto; }
.docs-editor-print figure,
.docs-editor-print pre,
.docs-editor-print table { break-inside: avoid; }
.docs-editor-print blockquote {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 3px solid #ccc;
  color: #444;
}
.docs-editor-print pre {
  padding: 0.75em 1em;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
  white-space: pre-wrap;
  word-break: break-word;
}
.docs-editor-print code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
}
.docs-editor-print table {
  width: 100%;
  border-collapse: collapse;
}
.docs-editor-print th,
.docs-editor-print td {
  border: 1px solid #ccc;
  padding: 0.4em 0.6em;
  text-align: left;
}
.docs-editor-print a { color: inherit; text-decoration: underline; }
.docs-editor-print hr {
  border: 0;
  border-top: 1px solid #ccc;
  margin: 1.5em 0;
}
`.trim();

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}
