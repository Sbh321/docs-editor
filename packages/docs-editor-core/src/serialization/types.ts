import type { DocumentNode } from "../schema";

/**
 * Turns a {@link DocumentNode} into an external representation. The document
 * model stays authoritative: an exporter only ever *reads* the model and
 * produces an outward representation, per ARCHITECTURE.md's Serialization
 * Architecture.
 *
 * `Output` defaults to `string` (HTML, Markdown, JSON, …). Binary and/or
 * asynchronous formats parameterize it instead — e.g. a DOCX exporter is a
 * `DocumentExporter<NodeName, Promise<Uint8Array>>`. This keeps one contract
 * shape across every format while staying honest about the payload: a format
 * that is genuinely binary or async says so in its type rather than pretending
 * to be a synchronous string.
 *
 * Because the default is `string`, existing exporters are unchanged, and the
 * synchronous {@link import("./registry").SerializationRegistry} — typed to the
 * `string` default — only accepts string exporters; binary ones are used
 * directly (they're async).
 */
export interface DocumentExporter<NodeName extends string = string, Output = string> {
  /** The format id this exporter produces (e.g. `"json"`, `"html"`, `"markdown"`, `"docx"`). */
  readonly format: string;
  /** Serializes `doc` to this exporter's format. */
  serialize(doc: DocumentNode<NodeName>): Output;
}

/**
 * Turns an external representation *into* a validated {@link DocumentNode} — the
 * counterpart to {@link DocumentExporter}. Implementations must rebuild the
 * document *through the schema* (like `DocumentSerializer.deserialize`) so
 * untrusted input is validated, not trusted — no external format becomes the
 * canonical representation.
 *
 * `Input` defaults to `string` and `Result` to `DocumentNode<NodeName>`. Binary
 * and/or asynchronous importers parameterize them — e.g. a DOCX importer is a
 * `DocumentImporter<NodeName, ArrayBuffer, Promise<DocumentNode<NodeName>>>`
 * (binary input, async result). The defaults keep every string importer and the
 * synchronous registry unchanged.
 */
export interface DocumentImporter<
  NodeName extends string = string,
  Input = string,
  Result = DocumentNode<NodeName>,
> {
  /** The format id this importer accepts (e.g. `"json"`, `"html"`, `"markdown"`, `"docx"`). */
  readonly format: string;
  /** Parses `input` in this importer's format into a validated document. */
  parse(input: Input): Result;
}
