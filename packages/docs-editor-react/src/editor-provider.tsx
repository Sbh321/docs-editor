import { useEffect, useMemo, useReducer, useState } from "react";

import { EditorDispatchContext, EditorStateContext } from "./editor-context";
import { EditorViewContext } from "./editor-view-context";

import type { EditorViewRegistry } from "./editor-view-context";
import type { Dispatch, EditorState, EditorView, Transaction } from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

export interface EditorProviderProps<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  /** The state to seed the editor with. Only read once, on mount — later changes to this prop are ignored. */
  readonly initialState: EditorState<NodeName, MarkName>;
  /** Called after every dispatched transaction with the resulting state. */
  readonly onStateChange?: (state: EditorState<NodeName, MarkName>) => void;
  readonly children?: ReactNode;
}

function applyTransaction<NodeName extends string, MarkName extends string>(
  state: EditorState<NodeName, MarkName>,
  transaction: Transaction<NodeName, MarkName>,
): EditorState<NodeName, MarkName> {
  return state.apply(transaction);
}

/**
 * Owns an `EditorState` and makes it (plus a stable `dispatch` function)
 * available to `useEditorState()`/`useEditorDispatch()` in descendants.
 * Doesn't render anything itself beyond `children` — this package ships no
 * visual editor component; see the package README for why.
 */
export function EditorProvider<NodeName extends string = string, MarkName extends string = string>(
  props: EditorProviderProps<NodeName, MarkName>,
): ReactNode {
  const [state, dispatch] = useReducer(applyTransaction<NodeName, MarkName>, props.initialState);
  const { onStateChange } = props;

  // A slot the mounted `<Editor />` registers its live view into, so floating
  // UI (selection toolbar, slash menu) can read caret coordinates and refocus
  // the editor. Held here — the shared root of every editor consumer — rather
  // than inside `<Editor />`, which is a leaf that can't provide to its
  // siblings.
  const [view, setView] = useState<EditorView | null>(null);
  const viewRegistry = useMemo<EditorViewRegistry>(() => ({ view, setView }), [view]);

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  return (
    <EditorStateContext.Provider value={state}>
      {/*
        Narrowing cast: `dispatch` only accepts this Provider's own
        `Transaction<NodeName, MarkName>`, narrower than the context's
        `Dispatch<string>` — safe here since `useEditorDispatch()` narrows
        back to the matching `NodeName`/`MarkName` (see editor-context.ts).
      */}
      <EditorDispatchContext.Provider value={dispatch as Dispatch<string>}>
        <EditorViewContext.Provider value={viewRegistry}>
          {props.children}
        </EditorViewContext.Provider>
      </EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  );
}
