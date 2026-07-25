import { EditorState as ProseMirrorEditorState, NodeSelection } from "prosemirror-state";

import { EngineConversionError } from "../errors";

import { compileEngineSchema } from "./compile-schema";
import { createEngineHistoryPlugin } from "./history";
import { fromEngineNode, toEngineNode } from "./node-conversion";
import { fromEngineSelection, toEngineSelection } from "./selection-conversion";
import { createEngineTablePlugin } from "./tables";

import type { EngineHistoryOptions } from "./history";
import type { DocumentNode, Mark, Schema } from "../../schema";
import type { Selection } from "../../selection";
import type {
  EditorStateConfig,
  Plugin,
  Transaction as ProseMirrorTransaction,
} from "prosemirror-state";

/** Engine-level options controlling which built-in plugins a state installs. */
export interface EngineStateOptions {
  readonly history?: EngineHistoryOptions;
  /** Installs the table-editing plugin (cell selection, navigation, table repair). */
  readonly tables?: boolean;
}

/**
 * Opaque handle to the engine's state object. Only functions in this module
 * (and its siblings under `src/engine/`) know its real shape — `src/state/`
 * treats it as a token to pass back into these functions.
 */
export type EngineState = ProseMirrorEditorState;

/** Opaque handle to the engine's in-progress transaction object. */
export type EngineTransaction = ProseMirrorTransaction;

export function createEngineState<NodeName extends string, MarkName extends string>(
  schema: Schema<NodeName, MarkName>,
  doc: DocumentNode<NodeName>,
  selection?: Selection,
  options?: EngineStateOptions,
): EngineState {
  const engineSchema = compileEngineSchema(schema);
  const engineDoc = toEngineNode(engineSchema, doc);

  const config: EditorStateConfig = { schema: engineSchema, doc: engineDoc };
  if (selection) {
    config.selection = toEngineSelection(engineDoc, selection);
  }

  const plugins: Plugin[] = [];
  if (options?.history) {
    plugins.push(createEngineHistoryPlugin(options.history));
  }
  if (options?.tables) {
    plugins.push(createEngineTablePlugin());
  }
  if (plugins.length > 0) {
    config.plugins = plugins;
  }

  return ProseMirrorEditorState.create(config);
}

export function engineStateDoc<NodeName extends string = string>(
  state: EngineState,
): DocumentNode<NodeName> {
  return fromEngineNode<NodeName>(state.doc);
}

export function engineStateSelection(state: EngineState): Selection {
  return fromEngineSelection(state.selection);
}

export function createEngineTransaction(state: EngineState): EngineTransaction {
  return state.tr;
}

export function applyEngineTransaction(
  state: EngineState,
  transaction: EngineTransaction,
): EngineState {
  return state.apply(transaction);
}

export function engineTransactionBefore<NodeName extends string = string>(
  transaction: EngineTransaction,
): DocumentNode<NodeName> {
  return fromEngineNode<NodeName>(transaction.before);
}

export function engineTransactionDoc<NodeName extends string = string>(
  transaction: EngineTransaction,
): DocumentNode<NodeName> {
  return fromEngineNode<NodeName>(transaction.doc);
}

export function engineTransactionSelection(transaction: EngineTransaction): Selection {
  return fromEngineSelection(transaction.selection);
}

export function engineTransactionDocChanged(transaction: EngineTransaction): boolean {
  return transaction.docChanged;
}

export function engineTransactionInsertText(
  transaction: EngineTransaction,
  text: string,
  from?: number,
  to?: number,
): void {
  transaction.insertText(text, from, to);
}

export function engineTransactionDelete(
  transaction: EngineTransaction,
  from: number,
  to: number,
): void {
  transaction.delete(from, to);
}

/** Replaces the range `from`..`to` with a single node (e.g. a leaf node like a divider). */
export function engineTransactionInsertNode<NodeName extends string = string>(
  transaction: EngineTransaction,
  node: DocumentNode<NodeName>,
  from: number,
  to: number,
): void {
  const engineSchema = transaction.doc.type.schema;
  transaction.replaceWith(from, to, toEngineNode(engineSchema, node));
}

export function engineTransactionSetSelection(
  transaction: EngineTransaction,
  selection: Selection,
): void {
  transaction.setSelection(toEngineSelection(transaction.doc, selection));
}

/** Flags the transaction to scroll its selection into view when the view dispatches it. */
export function engineTransactionScrollIntoView(transaction: EngineTransaction): void {
  transaction.scrollIntoView();
}

/** Selects the whole node at `pos` (the position directly before it) as a unit. */
export function engineTransactionSelectNode(transaction: EngineTransaction, pos: number): void {
  transaction.setSelection(NodeSelection.create(transaction.doc, pos));
}

export function engineTransactionAddMark(
  transaction: EngineTransaction,
  from: number,
  to: number,
  mark: Mark,
): void {
  const engineMarkType = transaction.doc.type.schema.marks[mark.type];
  if (!engineMarkType) {
    throw new EngineConversionError(
      `Unknown mark type "${mark.type}" when converting to the engine.`,
    );
  }
  transaction.addMark(from, to, engineMarkType.create(mark.attrs));
}

export function engineTransactionRemoveMark(
  transaction: EngineTransaction,
  from: number,
  to: number,
  markType: string,
): void {
  const engineMarkType = transaction.doc.type.schema.marks[markType];
  if (!engineMarkType) {
    throw new EngineConversionError(
      `Unknown mark type "${markType}" when converting to the engine.`,
    );
  }
  transaction.removeMark(from, to, engineMarkType);
}
