import { useCallback } from "react";

import { useEditor } from "../use-editor";
import { useEditorView } from "../use-editor-view";

import type { OutlineEntry } from "@sbh321/docs-editor-core";

/**
 * Returns a handler that moves the cursor to a heading and scrolls it into
 * view — the click behavior behind `OutlinePanel` and `TableOfContents`.
 * Places the caret just inside the heading (`from + 1`) and refocuses the
 * editor.
 */
export function useOutlineNavigation(): (entry: OutlineEntry) => void {
  const { state, dispatch } = useEditor();
  const view = useEditorView();

  return useCallback(
    (entry: OutlineEntry) => {
      const inside = entry.from + 1;
      dispatch(state.tr.setSelection({ anchor: inside, head: inside }).scrollIntoView());
      view?.focus();
    },
    [state, dispatch, view],
  );
}
