import { engineSelectedNode } from "../engine";

import type { DocumentNode } from "../schema";
import type { EditorState } from "../state";

/**
 * A node the selection covers as a unit, with the positions a caller needs to
 * act on it.
 */
export interface SelectedNode<NodeName extends string = string> {
  readonly node: DocumentNode<NodeName>;
  /** Position directly before the node — what `Transaction.setNodeAttrs` takes. */
  readonly from: number;
  /** Position directly after the node. */
  readonly to: number;
  /**
   * The containing node, or `null` when the node sits at the document root.
   *
   * Structural decisions need this: removing an image inside a `figure` has to
   * remove the figure too, because a figure with no media no longer satisfies
   * its content expression and would leave the document invalid.
   */
  readonly parent: {
    readonly node: DocumentNode<NodeName>;
    readonly from: number;
    readonly to: number;
    /** This node's index among the parent's children. */
    readonly index: number;
  } | null;
}

/**
 * The node currently selected *as a unit* — a node selection, as produced by
 * clicking an image or calling {@link import("../state").Transaction.selectNode}
 * — or `null` for an ordinary text selection.
 *
 * A query, never an edit: it answers "what is selected?" so a toolbar can
 * reflect it and a command can decide whether it applies.
 */
export function selectedNode<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
): SelectedNode<NodeName> | null {
  return engineSelectedNode<NodeName>(state.engine);
}
