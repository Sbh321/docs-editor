import { engineParseFromHtml, engineSerializeToHtml } from "../engine";

import type { DocumentExporter, DocumentImporter } from "./types";
import type { MarkRenderer, NodeRenderer } from "../dom-output-spec";
import type { HtmlParseSpec } from "../dom-parse-spec";
import type { DocumentNode, Schema } from "../schema";

export interface HtmlExporterOptions<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  readonly schema: Schema<NodeName, MarkName>;
  /**
   * How each node type renders to HTML — the *same* `DOMOutputSpec` map the
   * view uses (`paragraph: () => ["p", 0]`), so exported markup matches what's
   * rendered. Types without an entry fall back to a generic element named after
   * the type; provide renderers for clean, interoperable HTML.
   */
  readonly nodeRenderers?: NodeRenderer<NodeName>;
  /** The {@link HtmlExporterOptions.nodeRenderers} counterpart for marks. */
  readonly markRenderers?: MarkRenderer<MarkName>;
  /** DOM `document` to build with (defaults to `globalThis.document`; pass jsdom's in Node). */
  readonly document?: Document;
}

/**
 * The `"html"` {@link DocumentExporter} — serializes a {@link DocumentNode} to
 * an HTML string via the same renderer maps the view uses. Suitable for static
 * site generators, HTML editors, and (with a print stylesheet) print/PDF. HTML
 * *import* is a separate concern with its own security requirements — see
 * `HtmlImporter`.
 */
export class HtmlExporter<
  NodeName extends string = string,
  MarkName extends string = string,
> implements DocumentExporter<NodeName> {
  readonly format = "html";

  constructor(private readonly options: HtmlExporterOptions<NodeName, MarkName>) {}

  serialize(doc: DocumentNode<NodeName>): string {
    return engineSerializeToHtml(this.options.schema, doc, {
      ...(this.options.nodeRenderers ? { nodeRenderers: this.options.nodeRenderers } : {}),
      ...(this.options.markRenderers ? { markRenderers: this.options.markRenderers } : {}),
      ...(this.options.document ? { document: this.options.document } : {}),
    });
  }
}

export interface HtmlImporterOptions<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  readonly schema: Schema<NodeName, MarkName>;
  /**
   * Rules mapping DOM tags → node/mark types (the inverse of the exporter's
   * renderers). Without them the importer keeps text but recognizes no
   * structure, so provide rules for the tags you expect (`p` → paragraph,
   * `h1`–`h6` → heading, `strong`/`b` → bold, `a` → link, …).
   */
  readonly parseSpec?: HtmlParseSpec<NodeName, MarkName>;
  /** DOM `document` to build with (defaults to `globalThis.document`; pass jsdom's in Node). */
  readonly document?: Document;
}

/**
 * The `"html"` {@link DocumentImporter} — parses an HTML string into a
 * validated {@link DocumentNode}. **Security is built in:** the HTML is loaded
 * into an inert document and sanitized (dangerous elements removed, `on*`
 * handlers and `javascript:` URLs stripped) so arbitrary HTML is never
 * executed, and the result is rebuilt through the schema, so it's validated
 * like any other import. This is also what makes pasting external HTML (from
 * Google Docs, Word, a web page) map into the model instead of degrading to
 * plain text.
 */
export class HtmlImporter<
  NodeName extends string = string,
  MarkName extends string = string,
> implements DocumentImporter<NodeName> {
  readonly format = "html";

  constructor(private readonly options: HtmlImporterOptions<NodeName, MarkName>) {}

  parse(input: string): DocumentNode<NodeName> {
    return engineParseFromHtml(this.options.schema, input, {
      ...(this.options.parseSpec ? { parseSpec: this.options.parseSpec } : {}),
      ...(this.options.document ? { document: this.options.document } : {}),
    });
  }
}
