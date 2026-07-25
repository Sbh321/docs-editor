import { SchemaError } from "../schema";

/**
 * Thrown when deserialized data isn't even shaped like a document node/mark
 * (missing or non-string `type`, wrong container type, ...) — checked
 * before the data ever reaches `Schema.node()`/`Schema.text()`/`Schema.mark()`,
 * which validate everything else (unknown types, attrs, content, marks) and
 * throw their own, more specific `SchemaError` subtypes.
 */
export class InvalidSerializedDocumentError extends SchemaError {}
