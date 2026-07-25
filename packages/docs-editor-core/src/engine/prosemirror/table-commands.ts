import {
  addColumnAfter as proseMirrorAddColumnAfter,
  addColumnBefore as proseMirrorAddColumnBefore,
  addRowAfter as proseMirrorAddRowAfter,
  addRowBefore as proseMirrorAddRowBefore,
  deleteColumn as proseMirrorDeleteColumn,
  deleteRow as proseMirrorDeleteRow,
  deleteTable as proseMirrorDeleteTable,
  mergeCells as proseMirrorMergeCells,
  splitCell as proseMirrorSplitCell,
  toggleHeaderColumn as proseMirrorToggleHeaderColumn,
  toggleHeaderRow as proseMirrorToggleHeaderRow,
} from "prosemirror-tables";

import type { EngineState, EngineTransaction } from "./state";

type EngineDispatch = (transaction: EngineTransaction) => void;

/**
 * These wrap `prosemirror-tables`' editing commands one-for-one. Unlike the
 * list commands, they take no node-type argument — the plugin locates the
 * current table/cell from the selection — so they're plain pass-throughs,
 * the same shape as `undo`/`redo`. Each reports `false` (without dispatching)
 * when the selection isn't inside a table, so they compose in a keymap chain
 * and can drive an enabled/disabled toolbar button via a dry run.
 */

export function runEngineAddColumnBefore(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorAddColumnBefore(state, dispatch);
}

export function runEngineAddColumnAfter(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorAddColumnAfter(state, dispatch);
}

export function runEngineDeleteColumn(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorDeleteColumn(state, dispatch);
}

export function runEngineAddRowBefore(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorAddRowBefore(state, dispatch);
}

export function runEngineAddRowAfter(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorAddRowAfter(state, dispatch);
}

export function runEngineDeleteRow(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorDeleteRow(state, dispatch);
}

export function runEngineMergeCells(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorMergeCells(state, dispatch);
}

export function runEngineSplitCell(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorSplitCell(state, dispatch);
}

export function runEngineToggleHeaderRow(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorToggleHeaderRow(state, dispatch);
}

export function runEngineToggleHeaderColumn(
  state: EngineState,
  dispatch?: EngineDispatch,
): boolean {
  return proseMirrorToggleHeaderColumn(state, dispatch);
}

export function runEngineDeleteTable(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorDeleteTable(state, dispatch);
}
