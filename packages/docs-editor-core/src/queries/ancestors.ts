import { engineAncestorsAtSelection, engineNodeAt } from "../engine";

import type { DocumentNode } from "../schema";
import type { EditorState } from "../state";

/** One node containing the selection, with the position needed to edit it. */
export interface Ancestor {
  /** Position directly before the node — what `Transaction.setNodeAttrs` takes. */
  readonly pos: number;
  readonly type: string;
  readonly attrs: Record<string, unknown>;
  /** Nesting depth, 1 being a direct child of the document. */
  readonly depth: number;
}

/**
 * The chain of nodes containing the selection, **innermost first**.
 *
 * Structural commands need this and cannot get it elsewhere:
 * {@link import("./active-state").activeBlockType} reports only the textblock,
 * and {@link import("./selected-node").selectedNode} only answers for node
 * selections. Converting a bullet list to a numbered one means finding which
 * list the cursor is in — and for a nested list, the inner one, which is why
 * the order matters.
 *
 * A query, never an edit.
 */
export function ancestors<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
): readonly Ancestor[] {
  return engineAncestorsAtSelection(state.engine);
}

/**
 * The innermost ancestor whose type is one of `types`, or `null`.
 *
 * The common shape of the query above — "am I in a list, and where is it?".
 */
export function closestAncestor<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  types: readonly string[],
): Ancestor | null {
  return ancestors(state).find((ancestor) => types.includes(ancestor.type)) ?? null;
}

/**
 * The node starting at `pos`, or `null`.
 *
 * `pos` is the position directly *before* a node, matching what
 * {@link ancestors}, {@link import("./textblocks-in-selection").textblocksInSelection}
 * and `Transaction.setNodeAttrs` all use — so a position from any of those
 * resolves back to its node without re-walking the document by hand.
 */
export function nodeAt<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  pos: number,
): DocumentNode<NodeName> | null {
  return engineNodeAt<NodeName>(state.engine, pos);
}
