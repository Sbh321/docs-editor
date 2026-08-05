import { engineTextblocksInSelection } from "../engine";

import type { EditorState } from "../state";

/** A textblock the selection touches, with the position needed to edit it. */
export interface Textblock {
  /** Position directly before the node — what `Transaction.setNodeAttrs` takes. */
  readonly pos: number;
  readonly type: string;
  readonly attrs: Record<string, unknown>;
}

/**
 * Every textblock the selection touches, in document order.
 *
 * The counterpart to {@link import("./active-state").activeBlockType}, which
 * reports only the block at the selection's *start*. That is the right answer
 * for a toolbar showing "Heading 2", and the wrong one for applying a change: a
 * selection dragged across four paragraphs has to align all four.
 *
 * A query, never an edit — paragraph formatting commands read this and then
 * write through `Transaction.setNodeAttrs`.
 */
export function textblocksInSelection<
  NodeName extends string = string,
  MarkName extends string = string,
>(state: EditorState<NodeName, MarkName>): readonly Textblock[] {
  return engineTextblocksInSelection(state.engine);
}
