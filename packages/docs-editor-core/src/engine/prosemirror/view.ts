import { keydownHandler } from "prosemirror-keymap";
import { EditorView as ProseMirrorEditorView } from "prosemirror-view";

import { createDecorationHolder, resolveDecorationSet, setHolderDecorations } from "./decorations";
import { createCustomNodeView, createGenericMarkView, createGenericNodeView } from "./node-view";

import type { DecorationHolder } from "./decorations";
import type { EngineState, EngineTransaction } from "./state";
import type { Decoration } from "../../decoration";
import type { DOMOutputSpec } from "../../dom-output-spec";
import type { NodeViewFactory } from "../../node-view";
import type { DocumentNode, Mark } from "../../schema";
import type { DirectEditorProps } from "prosemirror-view";

/**
 * Opaque handle to the engine's view object — the piece that mounts a
 * document to a real DOM node and turns typing/composition/paste/drag
 * events into transactions. Only functions in this module know its real
 * shape, matching the {@link EngineState}/{@link EngineTransaction} pattern.
 */
export type EngineView = ProseMirrorEditorView;

type EngineKeyBinding = (
  state: EngineState,
  dispatch?: (transaction: EngineTransaction) => void,
) => boolean;

export interface EngineViewOptions {
  /** Called with every transaction the view produces (typing, IME, paste, ...). */
  readonly onDispatch: (transaction: EngineTransaction) => void;
  /** Whether the view's content is directly editable. Defaults to `true`. */
  readonly editable?: boolean;
  /** Overrides the schema's generic default rendering for specific node types, keyed by name. */
  readonly nodeRenderers?: Readonly<Record<string, (node: DocumentNode) => DOMOutputSpec>>;
  /**
   * Custom node views by type, taking precedence over `nodeRenderers` for the
   * same type — a view owns its node's DOM entirely.
   */
  readonly nodeViews?: Readonly<Record<string, NodeViewFactory>>;
  /** Overrides the schema's generic default rendering for specific mark types, keyed by name. */
  readonly markRenderers?: Readonly<Record<string, (mark: Mark) => DOMOutputSpec>>;
  /**
   * Key bindings, keyed by a `prosemirror-keymap` key string (e.g.
   * `"Mod-b"` — `"Mod-"` resolves to Cmd on Mac and Ctrl elsewhere).
   */
  readonly keymap?: Readonly<Record<string, EngineKeyBinding>>;
  /** Initial visual decorations (overlays). Update them later with {@link engineViewSetDecorations}. */
  readonly decorations?: readonly Decoration[];
}

// Each view's decoration holder, looked up by `engineViewSetDecorations`.
// A WeakMap keeps this out of the view object itself and lets it be collected
// with the view.
const decorationHolders = new WeakMap<EngineView, DecorationHolder>();

/**
 * Mounts a view onto `mount`. Delegates entirely to `prosemirror-view` for
 * the actual DOM/selection/input-event bridge (composition handling in
 * particular is notoriously hard to get right, and PM's own view has years
 * of browser-quirk fixes we'd otherwise have to rediscover) — this function
 * only adapts its callback shape to the rest of the engine adapter's
 * conventions.
 */
export function createEngineView(
  mount: HTMLElement,
  state: EngineState,
  options: EngineViewOptions,
): EngineView {
  const props: DirectEditorProps = {
    state,
    dispatchTransaction: options.onDispatch,
  };
  if (options.editable !== undefined) {
    const { editable } = options;
    props.editable = () => editable;
  }
  if (options.nodeRenderers || options.nodeViews) {
    const nodeRenderers = options.nodeRenderers ?? {};
    const nodeViews: DirectEditorProps["nodeViews"] = {};
    for (const name of Object.keys(nodeRenderers)) {
      const render = nodeRenderers[name];
      if (render) {
        nodeViews[name] = (node) => createGenericNodeView(node, render);
      }
    }
    // Custom views win over generic renderers for the same type: a view owns
    // its node's DOM, so a renderer for it would never be consulted anyway.
    for (const [name, factory] of Object.entries(options.nodeViews ?? {})) {
      nodeViews[name] = (node, _view, getPos) => createCustomNodeView(node, getPos, factory);
    }
    props.nodeViews = nodeViews;
  }
  if (options.markRenderers) {
    const { markRenderers } = options;
    const markViews: DirectEditorProps["markViews"] = {};
    for (const name of Object.keys(markRenderers)) {
      const render = markRenderers[name];
      if (render) {
        markViews[name] = (mark) => createGenericMarkView(mark, render);
      }
    }
    props.markViews = markViews;
  }
  if (options.keymap) {
    props.handleKeyDown = keydownHandler(options.keymap);
  }

  // Decorations are read from a per-view holder on every render, so they
  // survive `updateState` and stay in sync with whatever document the view is
  // currently showing — see `resolveDecorationSet`.
  const holder = createDecorationHolder(options.decorations ?? []);
  props.decorations = (pmState) => resolveDecorationSet(holder, pmState.doc);

  const view = new ProseMirrorEditorView(mount, props);
  decorationHolders.set(view, holder);
  return view;
}

/**
 * Replaces the view's visual decorations and re-renders to apply them, without
 * a document transaction — decorations are view state, not document state, so
 * routing them through `dispatchTransaction` (and the app's state reducer)
 * would be wrong. Positions are resolved against the current document each
 * render, so recomputing decorations after every edit is both correct and the
 * intended usage.
 */
export function engineViewSetDecorations(
  view: EngineView,
  decorations: readonly Decoration[],
  source?: string,
): void {
  const holder = decorationHolders.get(view);
  // `isDestroyed` guards the unmount race: a framework adapter may clear
  // decorations (in an effect cleanup) after the view has already been
  // destroyed, and `setProps` on a destroyed view throws.
  if (!holder || view.isDestroyed) {
    return;
  }
  setHolderDecorations(holder, decorations, source);
  // Re-set the `decorations` prop with a fresh function identity so the view
  // re-evaluates it and redraws — passing `{}` can leave the prop identity
  // unchanged, letting the view skip recomputing decorations.
  view.setProps({ decorations: (pmState) => resolveDecorationSet(holder, pmState.doc) });
}

export function engineViewDom(view: EngineView): HTMLElement {
  return view.dom;
}

/**
 * The document position corresponding to a DOM `node`/`offset` — the inverse of
 * rendering, via `prosemirror-view`'s own `posAtDOM`. Used to map a measured
 * block element back to its document position (e.g. for pagination spacing).
 */
export function engineViewPosAtDOM(view: EngineView, node: Node, offset: number): number {
  return view.posAtDOM(node, offset);
}

/**
 * The viewport pixel rectangle of the cursor position at `pos` — the caret's
 * top/bottom/left/right, as returned by `prosemirror-view`'s own
 * `coordsAtPos`. Used to anchor floating UI (a selection toolbar, a slash
 * menu) to a document position.
 */
export function engineViewCoordsAtPos(
  view: EngineView,
  pos: number,
): {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
} {
  return view.coordsAtPos(pos);
}

/** Syncs the view to a newly-applied state, without touching any other props. */
export function updateEngineViewState(view: EngineView, state: EngineState): void {
  view.updateState(state);
}

export function focusEngineView(view: EngineView): void {
  view.focus();
}

export function engineViewHasFocus(view: EngineView): boolean {
  return view.hasFocus();
}

export function destroyEngineView(view: EngineView): void {
  view.destroy();
}
