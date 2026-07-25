import { InvalidSerializedDocumentError } from "./errors";

import type { DocumentNode, Mark, Schema } from "../schema";

/**
 * Serializes documents to/from their native JSON representation for a
 * specific {@link Schema}. `DocumentNode` is already plain, JSON-safe data,
 * so `serialize()` is a thin, documented entry point — the real work is in
 * `deserialize()`, which rebuilds every node and mark through the schema's
 * own `node()`/`text()`/`mark()` constructors instead of trusting the input,
 * so untrusted or corrupted JSON is rejected with the same actionable
 * errors `Schema` already throws for hand-built data (see
 * `schema/errors.ts`), rather than silently becoming a malformed document.
 */
export class DocumentSerializer<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  constructor(private readonly schema: Schema<NodeName, MarkName>) {}

  /** Serializes `doc` to a JSON string. */
  serialize(doc: DocumentNode<NodeName>): string {
    return JSON.stringify(doc);
  }

  /**
   * Rebuilds a validated {@link DocumentNode} from `input` — either a JSON
   * string or already-parsed data (e.g. from `JSON.parse` you ran yourself,
   * or a value straight out of a database). Throws
   * `InvalidSerializedDocumentError` for data that isn't even shaped like a
   * node, or the relevant `SchemaError` subtype (`UnknownNodeTypeError`,
   * `InvalidContentError`, `InvalidAttributeError`, ...) for data that's
   * shaped right but violates this schema.
   */
  deserialize(input: unknown): DocumentNode<NodeName> {
    return this.reviveNode(typeof input === "string" ? this.parseJSON(input) : input);
  }

  private parseJSON(input: string): unknown {
    try {
      return JSON.parse(input) as unknown;
    } catch (cause) {
      throw new InvalidSerializedDocumentError(
        `Input is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  private reviveNode(data: unknown): DocumentNode<NodeName> {
    if (!isPlainObject(data) || typeof data.type !== "string") {
      throw new InvalidSerializedDocumentError(
        'Expected a document node to be an object with a string "type".',
      );
    }
    const type = data.type as NodeName;
    const marks = this.reviveMarks(data.marks);
    const attrs = isPlainObject(data.attrs) ? data.attrs : undefined;

    if (typeof data.text === "string") {
      return this.schema.text(data.text, marks, type);
    }

    const content = Array.isArray(data.content)
      ? data.content.map((child) => this.reviveNode(child))
      : [];
    return this.schema.node(type, attrs, content, marks);
  }

  private reviveMarks(data: unknown): Mark<MarkName>[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((markData) => {
      if (!isPlainObject(markData) || typeof markData.type !== "string") {
        throw new InvalidSerializedDocumentError(
          'Expected a mark to be an object with a string "type".',
        );
      }
      const attrs = isPlainObject(markData.attrs) ? markData.attrs : undefined;
      return this.schema.mark(markData.type as MarkName, attrs);
    });
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
