import {
  createEngineView,
  destroyEngineView,
  engineViewCoordsAtPos,
  engineViewDom,
  engineViewHasFocus,
  engineViewPosAtDOM,
  engineViewSetDecorations,
  focusEngineView,
  updateEngineViewState,
} from "../engine";
import { EditorState, Transaction } from "../state";

import type { Command } from "../commands";
import type { Decoration } from "../decoration";
import type { MarkRenderer, NodeRenderer } from "../dom-output-spec";
import type { EngineState, EngineTransaction, EngineView, EngineViewOptions } from "../engine";
import type { Schema } from "../schema";

/**
 * A viewport pixel rectangle for a document position — the caret's bounds, in
 * the same coordinate space as `getBoundingClientRect()`. Returned by
 * {@link EditorView.coordsAtPos} for anchoring floating UI.
 */
export interface ViewCoords {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface EditorViewOptions<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  readonly state: EditorState<NodeName, MarkName>;
  /** Called with every transaction the view produces from typing, IME composition, paste, or drag-and-drop. */
  readonly dispatchTransaction?: (transaction: Transaction<NodeName, MarkName>) => void;
  /** Whether the rendered document is directly editable. Defaults to `true`. */
  readonly editable?: boolean;
  /** Overrides the schema's generic default rendering for specific node types. */
  readonly nodeRenderers?: NodeRenderer<NodeName>;
  /** Overrides the schema's generic default rendering for specific mark types. */
  readonly markRenderers?: MarkRenderer<MarkName>;
  /**
   * Key bindings, keyed by a `prosemirror-keymap` key string (e.g.
   * `"Mod-b"` — `"Mod-"` resolves to Cmd on Mac and Ctrl elsewhere). Values
   * are ordinary `Command`s — `{ "Mod-b": toggleMark("bold") }` — run
   * against whatever state the view currently holds, dispatched the same
   * way typed input is.
   */
  readonly keymap?: Readonly<Record<string, Command<NodeName, MarkName>>>;
  /**
   * Initial visual decorations (overlays that paint a range without editing
   * the document — e.g. search-match highlights). Replace them at any time
   * with {@link EditorView.setDecorations}.
   */
  readonly decorations?: readonly Decoration[];
}

/**
 * Adapts a `Command` (operating on this package's own `EditorState`) into
 * the shape a `prosemirror-keymap` binding needs (operating on the raw
 * engine state) — reconstructing an `EditorState` wrapper around whatever
 * engine state the view currently holds when the key fires, since a
 * keybinding can run at any time, not just right after this view's last
 * `updateState()` call.
 */
function bridgeKeyBinding<NodeName extends string, MarkName extends string>(
  schema: Schema<NodeName, MarkName>,
  command: Command<NodeName, MarkName>,
): (engineState: EngineState, dispatch?: (transaction: EngineTransaction) => void) => boolean {
  return (engineState, dispatch) => {
    const state = EditorState.fromEngine(schema, engineState);
    return command(state, dispatch ? (transaction) => dispatch(transaction.engine) : undefined);
  };
}

function buildEngineKeymap<NodeName extends string, MarkName extends string>(
  schema: Schema<NodeName, MarkName>,
  keymap: Readonly<Record<string, Command<NodeName, MarkName>>>,
): NonNullable<EngineViewOptions["keymap"]> {
  const engineKeymap: Record<
    string,
    (engineState: EngineState, dispatch?: (transaction: EngineTransaction) => void) => boolean
  > = {};
  for (const [key, command] of Object.entries(keymap)) {
    engineKeymap[key] = bridgeKeyBinding(schema, command);
  }
  return engineKeymap;
}

/**
 * Renders an {@link EditorState} to a real, editable DOM node and turns user
 * input back into {@link Transaction}s. Wraps `prosemirror-view` entirely —
 * nothing here leaks a ProseMirror type, matching the rest of `src/engine/`'s
 * encapsulation (enforced by an ESLint rule restricting `prosemirror-*`
 * imports to `src/engine/**`).
 *
 * This class only owns the DOM/input bridge. Deciding *when* to construct,
 * update, and destroy one — i.e. component lifecycle — belongs to the
 * framework adapter (`@sbh321/docs-editor-react`'s `<Editor />`), per
 * CLAUDE.md's package ownership rules.
 */
export class EditorView<NodeName extends string = string, MarkName extends string = string> {
  private readonly engine: EngineView;

  constructor(mount: HTMLElement, options: EditorViewOptions<NodeName, MarkName>) {
    const engineOptions: EngineViewOptions = {
      onDispatch: (engineTransaction) => {
        options.dispatchTransaction?.(new Transaction<NodeName, MarkName>(engineTransaction));
      },
      ...(options.editable !== undefined ? { editable: options.editable } : {}),
      // Narrowing casts: each renderer is only ever invoked for its own
      // registered node/mark-type key (see `createEngineView`), so accepting
      // the narrower `DocumentNode<NodeName>`/`Mark<MarkName>` is safe even
      // though the engine's option type is expressed in terms of the wider,
      // type-erased `DocumentNode`/`Mark`.
      ...(options.nodeRenderers
        ? {
            nodeRenderers: options.nodeRenderers as unknown as NonNullable<
              EngineViewOptions["nodeRenderers"]
            >,
          }
        : {}),
      ...(options.markRenderers
        ? {
            markRenderers: options.markRenderers as unknown as NonNullable<
              EngineViewOptions["markRenderers"]
            >,
          }
        : {}),
      ...(options.keymap
        ? { keymap: buildEngineKeymap(options.state.schema, options.keymap) }
        : {}),
      ...(options.decorations ? { decorations: options.decorations } : {}),
    };
    this.engine = createEngineView(mount, options.state.engine, engineOptions);
  }

  /** The mounted, directly-editable DOM node. Avoid mutating its content directly. */
  get dom(): HTMLElement {
    return engineViewDom(this.engine);
  }

  /** Syncs the view to a newly-applied state, without touching any other options. */
  updateState(state: EditorState<NodeName, MarkName>): void {
    updateEngineViewState(this.engine, state.engine);
  }

  /**
   * The viewport pixel rectangle of the caret at document position `pos` —
   * use it to anchor floating UI (a selection toolbar, a slash menu) to a
   * position. Coordinates are in the same space as `getBoundingClientRect()`.
   */
  coordsAtPos(pos: number): ViewCoords {
    return engineViewCoordsAtPos(this.engine, pos);
  }

  /**
   * The document position mapping to a DOM `node`/`offset` — the inverse of
   * {@link EditorView.coordsAtPos}'s intent. Maps a rendered element back to a
   * document position, e.g. to turn a measured block element into the position
   * range a node {@link Decoration} needs. Mirrors `posAtDOM(node, 0)` at a
   * block's start returning the position just inside it.
   */
  posAtDOM(node: Node, offset: number): number {
    return engineViewPosAtDOM(this.engine, node, offset);
  }

  /**
   * Replaces the view's visual {@link Decoration}s — overlays that paint
   * ranges (e.g. search-match highlights) without touching the document.
   * Applies immediately; pass `[]` to clear. Decorations are view state, so
   * this does **not** go through the state/dispatch pipeline. Positions are
   * resolved against the current document on every render, so recompute and
   * call this whenever the document or your source (e.g. a search query)
   * changes.
   *
   * `source` names an independent contributor so several can coexist (search
   * highlighting, pagination spacers, …): each call replaces only its own
   * source, and the rendered decorations are the union of all sources. Defaults
   * to a shared `"default"` source.
   */
  setDecorations(decorations: readonly Decoration[], source?: string): void {
    engineViewSetDecorations(this.engine, decorations, source);
  }

  hasFocus(): boolean {
    return engineViewHasFocus(this.engine);
  }

  focus(): void {
    focusEngineView(this.engine);
  }

  /** Removes the view from the DOM. Call on unmount — the view cannot be reused afterward. */
  destroy(): void {
    destroyEngineView(this.engine);
  }
}
