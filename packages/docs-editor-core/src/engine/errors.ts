import { SchemaError } from "../schema/errors";

/**
 * Thrown when a {@link Schema} spec is structurally valid on its own but
 * doesn't satisfy a requirement specific to the underlying editing engine
 * (e.g. the ProseMirror engine requires the text node type to be named
 * "text"). Kept as a {@link SchemaError} subtype since it's still, at
 * bottom, a schema validation failure — just one discovered at
 * engine-compile time instead of schema-construction time.
 */
export class EngineSchemaError extends SchemaError {}

/**
 * Thrown when translating a {@link DocumentNode} or {@link Mark} to or from
 * the underlying engine's representation fails. This should only happen for
 * hand-built node data that never went through a {@link Schema}'s validated
 * constructors — the engine adapter always re-validates on the way in.
 */
export class EngineConversionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}
