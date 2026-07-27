import { DocumentSerializer } from "./document-serializer";

import type { DocumentExporter, DocumentImporter } from "./types";
import type { DocumentNode, Schema } from "../schema";

/**
 * The `"json"` {@link DocumentExporter} — the native format, and the reference
 * implementation of the serialization contract. Delegates to
 * {@link DocumentSerializer}, since `DocumentNode` is already JSON-safe data.
 */
export class JsonExporter<
  NodeName extends string = string,
  MarkName extends string = string,
> implements DocumentExporter<NodeName> {
  readonly format = "json";
  private readonly serializer: DocumentSerializer<NodeName, MarkName>;

  constructor(schema: Schema<NodeName, MarkName>) {
    this.serializer = new DocumentSerializer(schema);
  }

  serialize(doc: DocumentNode<NodeName>): string {
    return this.serializer.serialize(doc);
  }
}

/**
 * The `"json"` {@link DocumentImporter}. Rebuilds the document *through the
 * schema* (via {@link DocumentSerializer.deserialize}), so untrusted or
 * corrupted JSON is validated and rejected with actionable errors rather than
 * trusted — the model, not the JSON, stays authoritative.
 */
export class JsonImporter<
  NodeName extends string = string,
  MarkName extends string = string,
> implements DocumentImporter<NodeName> {
  readonly format = "json";
  private readonly serializer: DocumentSerializer<NodeName, MarkName>;

  constructor(schema: Schema<NodeName, MarkName>) {
    this.serializer = new DocumentSerializer(schema);
  }

  parse(input: string): DocumentNode<NodeName> {
    return this.serializer.deserialize(input);
  }
}
