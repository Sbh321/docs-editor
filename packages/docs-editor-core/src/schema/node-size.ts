import type { Schema } from "./schema";
import type { DocumentNode } from "./types";

/**
 * A node's size in the document's flat position space.
 *
 * The rule, which is easy to get wrong and expensive when it is:
 *
 * - a **text** node is its character length
 * - a **leaf** (a type declaring no `content`) is `1`
 * - anything else is its children's total plus `2`, for its own opening and
 *   closing boundary tokens
 *
 * The schema is required because "is this a leaf?" is a property of the node
 * *type*, not of whether a particular node happens to be empty — an empty
 * paragraph still occupies 2, not 1. Phase 7 shipped a version of this that
 * assumed leaves were 2 and produced positions that were wrong for every
 * document containing an image.
 *
 * Extracted in Phase 9, where a third copy would otherwise have appeared for
 * moving blocks.
 */
export function nodeSize<NodeName extends string, MarkName extends string>(
  node: DocumentNode<NodeName>,
  schema: Schema<NodeName, MarkName>,
): number {
  if (typeof node.text === "string") {
    return node.text.length;
  }
  if (schema.spec.nodes[node.type]?.content === undefined) {
    return 1;
  }
  let inner = 0;
  for (const child of node.content) {
    inner += nodeSize(child, schema);
  }
  return inner + 2;
}
