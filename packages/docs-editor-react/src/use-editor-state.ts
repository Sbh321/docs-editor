import { useContext } from "react";

import { EditorStateContext } from "./editor-context";

import type { EditorState } from "@sbh321/docs-editor-core";

/** Reads the current `EditorState` from the nearest `<EditorProvider>`. */
export function useEditorState<
  NodeName extends string = string,
  MarkName extends string = string,
>(): EditorState<NodeName, MarkName> {
  const state = useContext(EditorStateContext);
  if (!state) {
    throw new Error("useEditorState() must be used within an <EditorProvider>.");
  }
  return state as EditorState<NodeName, MarkName>;
}
