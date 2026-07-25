import {
  deleteSelection as proseMirrorDeleteSelection,
  exitCode as proseMirrorExitCode,
  lift as proseMirrorLift,
  newlineInCode as proseMirrorNewlineInCode,
  selectAll as proseMirrorSelectAll,
  setBlockType as proseMirrorSetBlockType,
  toggleMark as proseMirrorToggleMark,
  wrapIn as proseMirrorWrapIn,
} from "prosemirror-commands";

import { EngineConversionError } from "../errors";

import type { EngineState, EngineTransaction } from "./state";

type EngineDispatch = (transaction: EngineTransaction) => void;

/**
 * These wrap `prosemirror-commands`, a first-party ProseMirror package with
 * well-tested handling of the edge cases in "does this range already have
 * this mark" / "what happens at an empty selection" — reimplementing that
 * ourselves would mean re-solving problems PM's own team already has.
 * Remaining structural commands (split — needed for lists) are deferred
 * until that node type exists to define it against.
 */

export function runEngineDeleteSelection(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorDeleteSelection(state, dispatch);
}

export function runEngineSelectAll(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorSelectAll(state, dispatch);
}

export function runEngineToggleMark(
  state: EngineState,
  markType: string,
  attrs: Record<string, unknown> | undefined,
  dispatch?: EngineDispatch,
): boolean {
  const engineMarkType = state.schema.marks[markType];
  if (!engineMarkType) {
    throw new EngineConversionError(`Unknown mark type "${markType}" when running toggleMark.`);
  }
  return proseMirrorToggleMark(engineMarkType, attrs ?? null)(state, dispatch);
}

export function runEngineSetBlockType(
  state: EngineState,
  nodeType: string,
  attrs: Record<string, unknown> | undefined,
  dispatch?: EngineDispatch,
): boolean {
  const engineNodeType = state.schema.nodes[nodeType];
  if (!engineNodeType) {
    throw new EngineConversionError(`Unknown node type "${nodeType}" when running setBlockType.`);
  }
  return proseMirrorSetBlockType(engineNodeType, attrs ?? null)(state, dispatch);
}

export function runEngineWrapIn(
  state: EngineState,
  nodeType: string,
  attrs: Record<string, unknown> | undefined,
  dispatch?: EngineDispatch,
): boolean {
  const engineNodeType = state.schema.nodes[nodeType];
  if (!engineNodeType) {
    throw new EngineConversionError(`Unknown node type "${nodeType}" when running wrapIn.`);
  }
  return proseMirrorWrapIn(engineNodeType, attrs ?? null)(state, dispatch);
}

/** Lifts the selected block (or its closest liftable ancestor) out of its parent node. */
export function runEngineLift(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorLift(state, dispatch);
}

/** Inside a `code: true` node, replaces the selection with a newline character. Reports `false` elsewhere. */
export function runEngineNewlineInCode(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorNewlineInCode(state, dispatch);
}

/** Inside a `code: true` node, creates a default block after it and moves the cursor there. */
export function runEngineExitCode(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorExitCode(state, dispatch);
}

/**
 * Removes every mark from the current selection. Reports `false` when the
 * selection is empty (there's no range to clear). `removeMark` with a `null`
 * mark type clears all marks in the range.
 */
export function runEngineRemoveFormatting(state: EngineState, dispatch?: EngineDispatch): boolean {
  const { from, to, empty } = state.selection;
  if (empty) {
    return false;
  }
  if (dispatch) {
    dispatch(state.tr.removeMark(from, to, null));
  }
  return true;
}
