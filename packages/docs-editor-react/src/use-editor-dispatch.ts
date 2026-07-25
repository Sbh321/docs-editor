import { useContext } from "react";

import { EditorDispatchContext } from "./editor-context";

import type { Dispatch } from "@sbh321/docs-editor-core";

/**
 * Returns the `dispatch` function from the nearest `<EditorProvider>` —
 * stable across renders (`useReducer`'s own dispatch never changes), so
 * components that only call `dispatch` (e.g. a toolbar button) don't
 * re-render when the document changes.
 */
export function useEditorDispatch<NodeName extends string = string>(): Dispatch<NodeName> {
  const dispatch = useContext(EditorDispatchContext);
  if (!dispatch) {
    throw new Error("useEditorDispatch() must be used within an <EditorProvider>.");
  }
  // No cast needed: Dispatch<string> (accepting any Transaction<string>) is
  // already safely assignable to the narrower Dispatch<NodeName> by function
  // parameter contravariance.
  return dispatch;
}
