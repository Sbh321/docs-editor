import { useEffect, useReducer } from "react";

import { EditorDispatchContext, EditorStateContext } from "./editor-context";

import type { Dispatch, EditorState, Transaction } from "@sbh321/docs-editor-core";
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
        {props.children}
      </EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  );
}
