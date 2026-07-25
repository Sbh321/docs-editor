import { useEditorDispatch } from "./use-editor-dispatch";
import { useEditorState } from "./use-editor-state";

import type { Dispatch, EditorState } from "@sbh321/docs-editor-core";

export interface UseEditorResult<
  NodeName extends string = string,
  MarkName extends string = string,
> {
  readonly state: EditorState<NodeName, MarkName>;
  readonly dispatch: Dispatch<NodeName>;
}

/** Convenience combining `useEditorState()` and `useEditorDispatch()`. */
export function useEditor<
  NodeName extends string = string,
  MarkName extends string = string,
>(): UseEditorResult<NodeName, MarkName> {
  return {
    state: useEditorState<NodeName, MarkName>(),
    dispatch: useEditorDispatch<NodeName>(),
  };
}
