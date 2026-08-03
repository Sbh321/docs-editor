import {
  runEngineAddColumnAfter,
  runEngineAddColumnBefore,
  runEngineAddRowAfter,
  runEngineAddRowBefore,
  runEngineDeleteColumn,
  runEngineDeleteRow,
  runEngineDeleteTable,
  runEngineMergeCells,
  runEngineSplitCell,
  runEngineToggleHeaderColumn,
  runEngineToggleHeaderRow,
} from "../engine";

import { adaptDispatch } from "./adapt-dispatch";

import type { EditorState } from "../state";
import type { Dispatch } from "./types";

/**
 * These wrap `prosemirror-tables`' editing commands (via `../engine`). Unlike
 * the list commands, none take a node-type argument — the table-editing
 * plugin (enabled via `EditorState.create({ tables: tableEditing })`) locates the
 * current table and cell from the selection. Every one reports `false`
 * (without dispatching) when the selection isn't inside a table, so they
 * compose in a keymap chain and a dry run (calling with no `dispatch`) tells
 * a toolbar whether to enable the corresponding button. See
 * {@link deleteSelection} (in `./built-ins`) for why these are generic
 * functions rather than fixed `Command`-typed values.
 *
 * There's no `insertTable` command here: a table is an ordinary node built
 * with `Schema.node(...)` and inserted with `Transaction.insertNode(...)` —
 * the same primitive dividers/images use — so it needs no bespoke command,
 * mirroring how links needed nothing beyond `toggleMark`.
 */

/** Inserts a column before the column containing the current cell selection. */
export function addColumnBefore<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineAddColumnBefore(state.engine, adaptDispatch(dispatch));
}

/** Inserts a column after the column containing the current cell selection. */
export function addColumnAfter<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineAddColumnAfter(state.engine, adaptDispatch(dispatch));
}

/** Removes the column(s) spanned by the current cell selection. */
export function deleteColumn<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineDeleteColumn(state.engine, adaptDispatch(dispatch));
}

/** Inserts a row before the row containing the current cell selection. */
export function addRowBefore<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineAddRowBefore(state.engine, adaptDispatch(dispatch));
}

/** Inserts a row after the row containing the current cell selection. */
export function addRowAfter<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineAddRowAfter(state.engine, adaptDispatch(dispatch));
}

/** Removes the row(s) spanned by the current cell selection. */
export function deleteRow<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineDeleteRow(state.engine, adaptDispatch(dispatch));
}

/** Merges the selected cells into a single cell (requires a multi-cell selection). */
export function mergeCells<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineMergeCells(state.engine, adaptDispatch(dispatch));
}

/** Splits a merged cell back into its constituent cells. */
export function splitCell<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineSplitCell(state.engine, adaptDispatch(dispatch));
}

/** Toggles the selected row(s) between header cells and ordinary cells. */
export function toggleHeaderRow<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineToggleHeaderRow(state.engine, adaptDispatch(dispatch));
}

/** Toggles the selected column(s) between header cells and ordinary cells. */
export function toggleHeaderColumn<
  NodeName extends string = string,
  MarkName extends string = string,
>(state: EditorState<NodeName, MarkName>, dispatch?: Dispatch<NodeName>): boolean {
  return runEngineToggleHeaderColumn(state.engine, adaptDispatch(dispatch));
}

/** Removes the entire table containing the current selection. */
export function deleteTable<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineDeleteTable(state.engine, adaptDispatch(dispatch));
}
