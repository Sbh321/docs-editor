import { Fragment, Slice as ProseMirrorSlice } from "prosemirror-model";

import { fromEngineNode, toEngineNode } from "./node-conversion";

import type { EngineState, EngineTransaction } from "./state";
import type { ClipboardContent } from "../../clipboard";

/**
 * Extracts the content between `from` and `to` as a {@link ClipboardContent}.
 * Delegates to `Node.slice()`, which already handles the "open" boundary
 * nodes correctly (e.g. copying from mid-paragraph to mid-paragraph) —
 * reimplementing that by hand would mean re-solving a problem ProseMirror's
 * own team already has.
 */
export function engineStateCopy<NodeName extends string = string>(
  state: EngineState,
  from: number,
  to: number,
): ClipboardContent<NodeName> {
  const slice = state.doc.slice(from, to);
  return {
    content: slice.content.content.map((node) => fromEngineNode<NodeName>(node)),
    openStart: slice.openStart,
    openEnd: slice.openEnd,
  };
}

/**
 * Replaces the range between `from` and `to` with `content`, rejoining its
 * open boundaries with the surrounding content the same way ProseMirror's
 * own paste handling does.
 */
export function engineTransactionPaste<NodeName extends string = string>(
  transaction: EngineTransaction,
  content: ClipboardContent<NodeName>,
  from: number,
  to: number,
): void {
  const engineSchema = transaction.doc.type.schema;
  const nodes = content.content.map((node) => toEngineNode(engineSchema, node));
  const slice = new ProseMirrorSlice(Fragment.fromArray(nodes), content.openStart, content.openEnd);
  transaction.replace(from, to, slice);
}
