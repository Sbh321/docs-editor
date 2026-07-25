import {
  applyEngineTransaction,
  createEngineState,
  createEngineTransaction,
  engineStateCopy,
  engineStateDoc,
  engineStateSelection,
  engineTransactionAddMark,
  engineTransactionBefore,
  engineTransactionDelete,
  engineTransactionDoc,
  engineTransactionDocChanged,
  engineTransactionInsertNode,
  engineTransactionInsertText,
  engineTransactionPaste,
  engineTransactionRemoveMark,
  engineTransactionSelection,
  engineTransactionSetSelection,
} from "../engine";
import { selectionFrom, selectionTo } from "../selection";

import type { ClipboardContent } from "../clipboard";
import type { EngineState, EngineTransaction } from "../engine";
import type { DocumentNode, Mark, Schema } from "../schema";
import type { Selection } from "../selection";

/**
 * Configures undo/redo tracking for an {@link EditorState}. Pass `true` to
 * enable it with defaults, an object to tune it, or omit it entirely — history
 * tracking is opt-in, not automatic, per CLAUDE.md's "Explicit Over Implicit".
 */
export interface HistoryOptions {
  /** How many history events to keep before discarding the oldest. Defaults to 100. */
  readonly depth?: number;
  /** Milliseconds between edits after which a new undo group starts. Defaults to 500. */
  readonly newGroupDelay?: number;
}

/**
 * An in-progress, mutable set of document edits. Build one up via chained
 * calls (`state.tr.insertText(...).setSelection(...)`) and pass it to
 * {@link EditorState.apply} to produce the next state. Unlike `EditorState`,
 * a `Transaction` is intentionally mutable while it's being built — it only
 * becomes a fixed record of what happened once applied.
 *
 * The method surface here covers text/node/mark edits and selection.
 * Commands that restructure the tree around existing content (wrap, lift,
 * split — see `../commands`) build on these rather than adding their own
 * `Transaction` methods.
 */
export class Transaction<NodeName extends string = string, MarkName extends string = string> {
  /** @internal Reaches into this from `EditorState.apply`. Not part of the public contract. */
  readonly engine: EngineTransaction;

  /** @internal Construct via `EditorState.tr`, not directly. */
  constructor(engine: EngineTransaction) {
    this.engine = engine;
  }

  /** The document as it was before this transaction's edits. */
  get before(): DocumentNode<NodeName> {
    return engineTransactionBefore<NodeName>(this.engine);
  }

  /** The document produced by the edits made so far. */
  get doc(): DocumentNode<NodeName> {
    return engineTransactionDoc<NodeName>(this.engine);
  }

  /** The selection produced by the edits made so far. */
  get selection(): Selection {
    return engineTransactionSelection(this.engine);
  }

  /** Whether any edit in this transaction actually changed the document. */
  get docChanged(): boolean {
    return engineTransactionDocChanged(this.engine);
  }

  /**
   * Replaces the given range (or the current selection, if no range is
   * given) with a text node containing `text`.
   */
  insertText(text: string, from?: number, to?: number): this {
    engineTransactionInsertText(this.engine, text, from, to);
    return this;
  }

  /** Deletes the content between `from` and `to`. */
  delete(from: number, to: number): this {
    engineTransactionDelete(this.engine, from, to);
    return this;
  }

  /**
   * Replaces the range `from`..`to` (or the current selection, if omitted)
   * with a single `node` — e.g. inserting a leaf node like a divider at the
   * cursor. `node` must already be validated (built via `Schema.node()`).
   */
  insertNode(node: DocumentNode<NodeName>, from?: number, to?: number): this {
    const resolvedFrom = from ?? selectionFrom(this.selection);
    const resolvedTo = to ?? selectionTo(this.selection);
    engineTransactionInsertNode(this.engine, node, resolvedFrom, resolvedTo);
    return this;
  }

  /** Adds `mark` to the inline content between `from` and `to`. */
  addMark(from: number, to: number, mark: Mark<MarkName>): this {
    engineTransactionAddMark(this.engine, from, to, mark);
    return this;
  }

  /** Removes marks of type `markType` from the inline content between `from` and `to`. */
  removeMark(from: number, to: number, markType: MarkName): this {
    engineTransactionRemoveMark(this.engine, from, to, markType);
    return this;
  }

  /** Overrides the selection this transaction will produce when applied. */
  setSelection(selection: Selection): this {
    engineTransactionSetSelection(this.engine, selection);
    return this;
  }

  /**
   * Replaces the range between `from` and `to` (or the current selection,
   * if omitted) with `content`, rejoining its open boundaries with the
   * surrounding content — the counterpart to {@link EditorState.copy}.
   *
   * There's no separate `cut`: it's `state.copy()` followed by
   * `state.tr.delete(...)` (or `paste` with empty content) — cut needs to
   * hand the copied content to the caller (to put on the system clipboard),
   * which doesn't fit a single mutating `Transaction` method, and writing to
   * the system clipboard is a DOM/application concern this headless package
   * never touches.
   */
  paste(content: ClipboardContent<NodeName>, from?: number, to?: number): this {
    const resolvedFrom = from ?? selectionFrom(this.selection);
    const resolvedTo = to ?? selectionTo(this.selection);
    engineTransactionPaste(this.engine, content, resolvedFrom, resolvedTo);
    return this;
  }
}

/**
 * The document and selection at one point in time. Immutable — `apply()`
 * always returns a new `EditorState`, leaving the original untouched.
 */
export class EditorState<NodeName extends string = string, MarkName extends string = string> {
  readonly schema: Schema<NodeName, MarkName>;
  readonly doc: DocumentNode<NodeName>;
  readonly selection: Selection;

  /** @internal Read by `../commands` to drive engine-backed commands. Not part of the public contract. */
  readonly engine: EngineState;

  private constructor(schema: Schema<NodeName, MarkName>, engine: EngineState) {
    this.schema = schema;
    this.engine = engine;
    this.doc = engineStateDoc<NodeName>(engine);
    this.selection = engineStateSelection(engine);
  }

  /**
   * Creates a new state. `doc` is required rather than defaulted to an
   * empty document, since an arbitrary schema's content constraints (e.g.
   * `doc: "paragraph+"`) may not permit an empty top-level node — build a
   * valid starting document with `schema.createDocument(...)` first.
   */
  static create<NodeName extends string, MarkName extends string>(config: {
    readonly schema: Schema<NodeName, MarkName>;
    readonly doc: DocumentNode<NodeName>;
    readonly selection?: Selection;
    readonly history?: boolean | HistoryOptions;
    /**
     * Enables interactive table editing (rectangular cell selection, cell
     * navigation, table repair). Opt-in like `history`, and only meaningful
     * for a schema that declares table node types (see `NodeSpec.tableRole`).
     */
    readonly tables?: boolean;
  }): EditorState<NodeName, MarkName> {
    const historyOptions = config.history
      ? config.history === true
        ? {}
        : config.history
      : undefined;
    const engine = createEngineState(config.schema, config.doc, config.selection, {
      ...(historyOptions ? { history: historyOptions } : {}),
      ...(config.tables ? { tables: config.tables } : {}),
    });
    return new EditorState(config.schema, engine);
  }

  /**
   * @internal Wraps an already-existing engine state (e.g. a live view's
   * current `view.state`) instead of creating a new one. Used by `../view`
   * to run `Command`s from a keymap binding against whatever state the view
   * currently holds. Not part of the public contract.
   */
  static fromEngine<NodeName extends string, MarkName extends string>(
    schema: Schema<NodeName, MarkName>,
    engine: EngineState,
  ): EditorState<NodeName, MarkName> {
    return new EditorState(schema, engine);
  }

  /** Starts a new transaction from this state. */
  get tr(): Transaction<NodeName, MarkName> {
    return new Transaction<NodeName, MarkName>(createEngineTransaction(this.engine));
  }

  /** Applies a transaction, producing the next state. */
  apply(transaction: Transaction<NodeName, MarkName>): EditorState<NodeName, MarkName> {
    const nextEngine = applyEngineTransaction(this.engine, transaction.engine);
    return new EditorState(this.schema, nextEngine);
  }

  /**
   * Copies the content between `from` and `to` (or the current selection,
   * if omitted) as a {@link ClipboardContent} — a plain, JSON-safe value
   * suitable for holding onto, writing to the system clipboard (an
   * application/adapter concern, not this package's), or passing straight
   * to {@link Transaction.paste}.
   */
  copy(from?: number, to?: number): ClipboardContent<NodeName> {
    const resolvedFrom = from ?? selectionFrom(this.selection);
    const resolvedTo = to ?? selectionTo(this.selection);
    return engineStateCopy<NodeName>(this.engine, resolvedFrom, resolvedTo);
  }
}
