import { HtmlImporter } from "@sbh321/docs-editor-core";
import mammoth from "mammoth";

import type {
  DocumentImporter,
  DocumentNode,
  HtmlParseSpec,
  Schema,
} from "@sbh321/docs-editor-core";

/** The binary input a {@link DocxImporter} accepts — raw `.docx` file bytes. */
export type DocxInput = ArrayBuffer | Uint8Array;

export interface DocxImporterOptions<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  readonly schema: Schema<NodeName, MarkName>;
  /**
   * Tag → node/mark rules for the intermediate HTML, passed straight to the
   * core {@link HtmlImporter}. Because `mammoth` emits standard HTML (`h1`–`h6`,
   * `p`, `ul`/`ol`/`li`, `strong`, `em`, `a`, `table`, …), the *same* parse spec
   * used for HTML import works here. Without it, text is kept but no structure
   * is recognized.
   */
  readonly parseSpec?: HtmlParseSpec<NodeName, MarkName>;
  /** DOM `document` for the HTML step (defaults to `globalThis.document`; pass jsdom's in Node). */
  readonly document?: Document;
  /**
   * Optional `mammoth` style map (e.g. mapping Word paragraph styles to HTML
   * elements). See mammoth's docs; omit for its sensible defaults.
   */
  readonly styleMap?: string | readonly string[];
}

/**
 * The `"docx"` {@link DocumentImporter} — parses a Microsoft Word `.docx` file
 * into a validated {@link DocumentNode}.
 *
 * Binary input, asynchronous result, so it implements the generalized contract
 * as `DocumentImporter<NodeName, DocxInput, Promise<DocumentNode<NodeName>>>`.
 *
 * **Security rides the HTML path:** `mammoth` converts the `.docx` to plain HTML,
 * which is then fed through the core {@link HtmlImporter} — the input is
 * sanitized (dangerous elements/attributes removed) and rebuilt through the
 * schema, so nothing executes and the result is validated like any other
 * import. There is no second parsing/sanitization surface to trust.
 */
export class DocxImporter<
  NodeName extends string = string,
  MarkName extends string = string,
> implements DocumentImporter<NodeName, DocxInput, Promise<DocumentNode<NodeName>>> {
  readonly format = "docx";

  constructor(private readonly options: DocxImporterOptions<NodeName, MarkName>) {}

  async parse(input: DocxInput): Promise<DocumentNode<NodeName>> {
    const { styleMap } = this.options;
    const normalizedStyleMap =
      styleMap === undefined ? undefined : typeof styleMap === "string" ? styleMap : [...styleMap];
    const { value: html } = await mammoth.convertToHtml(
      mammothInput(input),
      normalizedStyleMap ? { styleMap: normalizedStyleMap } : {},
    );

    const importer = new HtmlImporter<NodeName, MarkName>({
      schema: this.options.schema,
      ...(this.options.parseSpec ? { parseSpec: this.options.parseSpec } : {}),
      ...(this.options.document ? { document: this.options.document } : {}),
    });
    return importer.parse(html);
  }
}

/**
 * mammoth's input shape is environment-specific: its Node build reads a
 * `Buffer`, its browser build an `ArrayBuffer`. We hand it whichever the current
 * runtime supports, so the same importer works in Node and the browser.
 */
function mammothInput(input: DocxInput): { buffer: Buffer } | { arrayBuffer: ArrayBuffer } {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const globalBuffer = (globalThis as { Buffer?: { from(data: Uint8Array): Buffer } }).Buffer;
  if (globalBuffer) {
    return { buffer: globalBuffer.from(bytes) };
  }
  return {
    arrayBuffer: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  };
}
