import {
  createEngineView,
  destroyEngineView,
  engineViewDom,
  engineViewHasFocus,
  focusEngineView,
  updateEngineViewState,
} from "../engine";
import { EditorState, Transaction } from "../state";

import type { Command } from "../commands";
import type { MarkRenderer, NodeRenderer } from "../dom-output-spec";
import type { EngineState, EngineTransaction, EngineView, EngineViewOptions } from "../engine";
import type { Schema } from "../schema";

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
