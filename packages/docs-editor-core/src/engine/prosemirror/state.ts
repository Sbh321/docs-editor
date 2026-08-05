import { EditorState as ProseMirrorEditorState, NodeSelection } from "prosemirror-state";

import { EngineConversionError } from "../errors";

import { compileEngineSchema } from "./compile-schema";
import { createEngineHistoryPlugin } from "./history";
import { fromEngineNode, toEngineNode } from "./node-conversion";
import { fromEngineSelection, toEngineSelection } from "./selection-conversion";

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
  /**
   * Builds the table-editing plugin (cell selection, navigation, table repair)
   * to install.
   *
   * A factory supplied by the caller rather than a boolean this module resolves
   * itself: importing the implementation here would tie it to *every* state,
   * since a reference inside `if (options.tables)` is one no bundler can prove
   * unreachable. That cost headless bundles the entire table stack — 37.6 KB
   * gzip — for a feature they never enabled. Returns `unknown` so no engine
   * type escapes to `src/state/`; it is cast back here.
   */
  readonly tables?: () => unknown;
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
    plugins.push(options.tables() as Plugin);
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
/**
 * Replaces the attributes of the node at `pos`, leaving its type and content
 * alone — the primitive behind resizing, aligning or re-captioning a node.
 *
 * `attrs` must already be validated against the schema; like
 * {@link engineTransactionInsertNode}, this layer performs no validation
 * because it has no schema to validate against. Commands in `../commands` and
 * `../media` validate through `Schema.blockType()` before calling it.
 */
export function engineTransactionSetNodeAttrs(
  transaction: EngineTransaction,
  pos: number,
  attrs: Record<string, unknown>,
): void {
  transaction.setNodeMarkup(pos, null, attrs);
}

/**
 * Replaces the *type* (and attributes) of the node at `pos`, keeping its
 * content — how a bullet list becomes a numbered one without its items being
 * removed and rebuilt, which would destroy the selection inside them.
 */
export function engineTransactionSetNodeType(
  transaction: EngineTransaction,
  pos: number,
  type: string,
  attrs: Record<string, unknown>,
): void {
  const engineType = transaction.doc.type.schema.nodes[type];
  if (!engineType) {
    throw new EngineConversionError(`Unknown node type "${type}" when converting to the engine.`);
  }
  transaction.setNodeMarkup(pos, engineType, attrs);
}

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
  markType: string | null,
): void {
  // `null` means every mark, which is what ProseMirror's own `removeMark`
  // takes a null mark type to mean — the primitive "clear formatting" needs.
  if (markType === null) {
    transaction.removeMark(from, to, null);
    return;
  }
  const engineMarkType = transaction.doc.type.schema.marks[markType];
  if (!engineMarkType) {
    throw new EngineConversionError(
      `Unknown mark type "${markType}" when converting to the engine.`,
    );
  }
  transaction.removeMark(from, to, engineMarkType);
}
