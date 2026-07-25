import { runEngineRedo, runEngineUndo } from "../engine";

import { adaptDispatch } from "./adapt-dispatch";

import type { EditorState } from "../state";
import type { Dispatch } from "./types";

/**
 * Undoes the last change, if any. Reports `false` (and does nothing) when
 * there is nothing to undo — including when the state's `EditorState` was
 * created without `history` enabled, since `prosemirror-history` treats an
 * absent history plugin the same as an empty undo stack.
 *
 * Generic for the same reason {@link deleteSelection} in `built-ins.ts` is:
 * `NodeName`/`MarkName` must be inferred fresh from whichever `EditorState`
 * this is actually called with.
 */
export function undo<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineUndo(state.engine, adaptDispatch(dispatch));
}

/** Redoes the last undone change, if any. See {@link undo} for when it reports `false`. */
export function redo<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineRedo(state.engine, adaptDispatch(dispatch));
}
