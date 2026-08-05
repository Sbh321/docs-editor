export { matchesContentExpression, nodeGroups, parseContentExpression } from "./content-expression";
export {
  InvalidAttributeError,
  InvalidContentError,
  InvalidContentExpressionError,
  InvalidMarkError,
  SchemaError,
  UnknownContentReferenceError,
  UnknownMarkTypeError,
  UnknownNodeTypeError,
} from "./errors";
export { createSchema, Schema } from "./schema";
export { isTextNode } from "./types";

export type { ContentDescriptor, ContentExpression, ContentTerm } from "./content-expression";
export type { AttributeSpec, DocumentNode, Mark, MarkSpec, NodeSpec, SchemaSpec } from "./types";
export { nodeSize } from "./node-size";
