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
  engineTransactionScrollIntoView,
  engineTransactionSelectNode,
  engineTransactionSelection,
  engineTransactionSetNodeAttrs,
  engineTransactionSetNodeType,
  engineTransactionSetSelection,
} from "../engine";
import { selectionFrom, selectionTo } from "../selection";

import type { ClipboardContent } from "../clipboard";
import type { EngineState, EngineTransaction } from "../engine";
import type { EditorPlugin } from "./editor-plugin";
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

  /**
   * Removes marks of type `markType` from the inline content between `from` and
   * `to`, or **every** mark when `markType` is `null`.
   *
   * The `null` form is what lets "clear formatting" be one transaction rather
   * than two: clearing marks and resetting block attributes are separate edits,
   * and dispatching them separately would cost the user two presses of undo to
   * get back to where they started.
   */
  removeMark(from: number, to: number, markType: MarkName | null): this {
    engineTransactionRemoveMark(this.engine, from, to, markType);
    return this;
  }

  /**
   * Replaces the attributes of the node at `pos`, leaving its type and content
   * untouched — how a node's own properties change in place (resizing or
   * aligning an image, re-levelling a heading) without rebuilding it and losing
   * its children.
   *
   * `attrs` must already be validated, the same contract as
   * {@link Transaction.insertNode}: a `Transaction` has no schema to validate
   * against. Build them with `Schema.blockType(type, attrs)`, which is what the
   * media commands in `../media` do.
   */
  setNodeAttrs(pos: number, attrs: Record<string, unknown>): this {
    engineTransactionSetNodeAttrs(this.engine, pos, attrs);
    return this;
  }

  /**
   * Replaces the *type* and attributes of the node at `pos`, keeping its
   * content — how a bullet list becomes a numbered one, or a plain list item a
   * task item, without its children being removed and rebuilt (which would
   * destroy any selection inside them).
   *
   * `attrs` must already be validated, the same contract as
   * {@link Transaction.setNodeAttrs}. Build them with `Schema.blockType(type,
   * attrs)` against the **target** type, so attributes the new type does not
   * declare cannot come along.
   */
  setNodeType(pos: number, type: NodeName, attrs: Record<string, unknown>): this {
    engineTransactionSetNodeType(this.engine, pos, type, attrs);
    return this;
  }

  /** Overrides the selection this transaction will produce when applied. */
  setSelection(selection: Selection): this {
    engineTransactionSetSelection(this.engine, selection);
    return this;
  }

  /**
   * Selects the whole node at `pos` (the position directly before it) as a
   * unit — e.g. selecting an image or divider so it can be replaced or deleted
   * with {@link import("../commands").deleteSelection}. `pos` must point at a
   * selectable node, or this fails with an actionable error. The resulting
   * selection reads back as `{ type: "node" }`.
   */
  selectNode(pos: number): this {
    engineTransactionSelectNode(this.engine, pos);
    return this;
  }

  /**
   * Flags this transaction so a live {@link import("../view").EditorView}
   * scrolls the resulting selection into view when it dispatches — e.g. after
   * moving the cursor to a heading from an outline. A no-op for headless,
   * viewless use.
   */
  scrollIntoView(): this {
    engineTransactionScrollIntoView(this.engine);
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
  readonly selection: Selection;

  /** @internal Read by `../commands` to drive engine-backed commands. Not part of the public contract. */
  readonly engine: EngineState;

  /** Memoized result of {@link EditorState.doc}; `null` until first read. */
  private convertedDoc: DocumentNode<NodeName> | null = null;

  private constructor(schema: Schema<NodeName, MarkName>, engine: EngineState) {
    this.schema = schema;
    this.engine = engine;
    this.selection = engineStateSelection(engine);
  }

  /**
   * The current document.
   *
   * Computed on first read and then memoized, rather than eagerly in the
   * constructor: a state is created for *every* transaction — including ones
   * that only move the cursor — and many of those states are never asked for
   * their document at all. Deferring the conversion keeps that work off the
   * per-keystroke path (ROADMAP Phase 6, Milestone 6.2).
   *
   * The conversion itself reuses cached results for engine nodes an edit didn't
   * touch (see `../engine/prosemirror/node-conversion.ts`), so reading this
   * after a small edit costs roughly the size of the change rather than the size
   * of the document — and an edit that leaves a subtree alone returns the
   * identical object for it, which makes `state.doc` identity a valid "did the
   * document change?" signal for memoization.
   */
  get doc(): DocumentNode<NodeName> {
    this.convertedDoc ??= engineStateDoc<NodeName>(this.engine);
    return this.convertedDoc;
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
     * navigation, table repair). Only meaningful for a schema that declares
     * table node types (see `NodeSpec.tableRole`).
     *
     * Pass the {@link EditorPlugin} from the `tables` entry point rather than a
     * flag, so documents that never use tables don't carry the implementation:
     *
     * ```ts
     * import { tableEditing } from "@sbh321/docs-editor-core/tables";
     * EditorState.create({ schema, doc, tables: tableEditing });
     * ```
     */
    readonly tables?: EditorPlugin;
  }): EditorState<NodeName, MarkName> {
    const historyOptions = config.history
      ? config.history === true
        ? {}
        : config.history
      : undefined;
    // Bound to a local so the engine receives a factory that closes over the
    // plugin, keeping the implementation out of this module's import graph.
    const tables = config.tables;
    const engine = createEngineState(config.schema, config.doc, config.selection, {
      ...(historyOptions ? { history: historyOptions } : {}),
      ...(tables ? { tables: () => tables.createEnginePlugin() } : {}),
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
