import { SchemaError } from "../schema";

/**
 * Thrown when deserialized data isn't even shaped like a document node/mark
 * (missing or non-string `type`, wrong container type, ...) — checked
 * before the data ever reaches `Schema.node()`/`Schema.text()`/`Schema.mark()`,
 * which validate everything else (unknown types, attrs, content, marks) and
 * throw their own, more specific `SchemaError` subtypes.
 */
export class InvalidSerializedDocumentError extends SchemaError {}

/** Base class for {@link import("./registry").SerializationRegistry} lookup errors. */
export class SerializationRegistryError extends Error {}

/** Thrown when registering an importer/exporter under a format id that's already taken. */
export class DuplicateFormatError extends SerializationRegistryError {
  constructor(format: string, kind: "importer" | "exporter") {
    super(`An ${kind} is already registered for format "${format}".`);
    this.name = "DuplicateFormatError";
  }
}

/** Thrown when looking up an importer/exporter for a format that isn't registered. */
export class UnknownFormatError extends SerializationRegistryError {
  constructor(format: string, kind: "importer" | "exporter") {
    super(`No ${kind} is registered for format "${format}".`);
    this.name = "UnknownFormatError";
  }
}
