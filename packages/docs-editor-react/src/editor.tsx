import { EditorView } from "@sbh321/docs-editor-core";
import { useContext, useEffect, useRef } from "react";

import { EditorViewContext } from "./editor-view-context";
import { useEditor } from "./use-editor";

import type { Command, MarkRenderer, NodeRenderer } from "@sbh321/docs-editor-core";
import type { CSSProperties, ReactNode } from "react";

export interface EditorProps<NodeName extends string = string, MarkName extends string = string> {
  readonly className?: string;
  /** Inline styles for the editor's container element — e.g. a zoom transform (see `ZoomControls`). */
  readonly style?: CSSProperties;
  /** Whether the rendered document is directly editable. Defaults to `true`. */
  readonly editable?: boolean;
  /**
   * Overrides the generic default rendering for specific node types (e.g.
   * paragraph → `<p>`). Read only once, when the view mounts — like
   * `dispatch`, later changes are ignored, so an inline object literal here
   * won't force-remount the view on every render.
   */
  readonly nodeRenderers?: NodeRenderer<NodeName>;
  /** The {@link EditorProps.nodeRenderers} counterpart for marks. */
  readonly markRenderers?: MarkRenderer<MarkName>;
  /**
   * Key bindings, keyed by a `prosemirror-keymap` string (e.g. `"Mod-b"` —
   * `"Mod-"` resolves to Cmd on Mac and Ctrl elsewhere). Values are ordinary
   * `Command`s, e.g. `{ "Mod-b": toggleMark("bold") }`. Read only once, at
   * mount, the same as `nodeRenderers`/`markRenderers`.
   */
  readonly keymap?: Readonly<Record<string, Command<NodeName, MarkName>>>;
}

/**
 * Renders the current editor state to a real, editable DOM node. Must be
 * rendered inside an `EditorProvider`. Delegates entirely to
 * `docs-editor-core`'s `EditorView`, which wraps `prosemirror-view` — no
 * ProseMirror type crosses into this package, matching the rest of the
 * core/adapter boundary.
 */
export function Editor<NodeName extends string = string, MarkName extends string = string>(
  props: EditorProps<NodeName, MarkName>,
): ReactNode {
  const { state, dispatch } = useEditor<NodeName, MarkName>();
  const viewRegistry = useContext(EditorViewContext);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView<NodeName, MarkName> | null>(null);
  const { editable, nodeRenderers, markRenderers, keymap } = props;

  // Mounts the view once and tears it down on unmount. Later `state` changes
  // are synced via `updateState()` below rather than by reconstructing the
  // view — recreating it on every state change would drop DOM selection,
  // IME composition state, and scroll position on every keystroke.
  // `nodeRenderers`/`markRenderers` are captured the same way, deliberately
  // excluded from the dependency array: they're typically written as inline
  // object literals, which get a new identity every render, and remounting
  // the view whenever that identity changes would defeat the point above.
  useEffect(() => {
    if (!mountRef.current) {
      return undefined;
    }
    const view = new EditorView<NodeName, MarkName>(mountRef.current, {
      state,
      dispatchTransaction: dispatch,
      ...(editable !== undefined ? { editable } : {}),
      ...(nodeRenderers ? { nodeRenderers } : {}),
      ...(markRenderers ? { markRenderers } : {}),
      ...(keymap ? { keymap } : {}),
    });
    viewRef.current = view;
    // Publish the live view so floating UI siblings can position against it.
    // `setView` (from the provider's `useState`) is stable, so this doesn't
    // belong in the dependency array; `viewRegistry` is captured at mount.
    viewRegistry?.setView(view);
    return () => {
      view.destroy();
      viewRef.current = null;
      viewRegistry?.setView(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above.
  }, [dispatch, editable]);

  useEffect(() => {
    viewRef.current?.updateState(state);
  }, [state]);

  return <div className={props.className} style={props.style} ref={mountRef} />;
}
