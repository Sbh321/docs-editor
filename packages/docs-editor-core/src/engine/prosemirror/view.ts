import { keydownHandler } from "prosemirror-keymap";
import { EditorView as ProseMirrorEditorView } from "prosemirror-view";

import { createGenericMarkView, createGenericNodeView } from "./node-view";

import type { EngineState, EngineTransaction } from "./state";
import type { DOMOutputSpec } from "../../dom-output-spec";
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
  /** Overrides the schema's generic default rendering for specific mark types, keyed by name. */
  readonly markRenderers?: Readonly<Record<string, (mark: Mark) => DOMOutputSpec>>;
  /**
   * Key bindings, keyed by a `prosemirror-keymap` key string (e.g.
   * `"Mod-b"` — `"Mod-"` resolves to Cmd on Mac and Ctrl elsewhere).
   */
  readonly keymap?: Readonly<Record<string, EngineKeyBinding>>;
}

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
  if (options.nodeRenderers) {
    const { nodeRenderers } = options;
    const nodeViews: DirectEditorProps["nodeViews"] = {};
    for (const name of Object.keys(nodeRenderers)) {
      const render = nodeRenderers[name];
      if (render) {
        nodeViews[name] = (node) => createGenericNodeView(node, render);
      }
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
  return new ProseMirrorEditorView(mount, props);
}

export function engineViewDom(view: EngineView): HTMLElement {
  return view.dom;
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
