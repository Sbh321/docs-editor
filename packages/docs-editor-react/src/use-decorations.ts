import { useEffect } from "react";

import { useEditorView } from "./use-editor-view";

import type { Decoration } from "@sbh321/docs-editor-core";

/**
 * Applies visual {@link Decoration}s (overlays that paint ranges without
 * editing the document) to the current editor view, and clears them when the
 * component unmounts. A no-op until an `<Editor />` has mounted.
 *
 * `decorations` should be a stable/memoized array — the view re-applies
 * whenever its identity changes. This is the generic building block behind
 * {@link useSearchHighlight}; use it directly for other overlays (comment
 * ranges, spellcheck, …).
 */
export function useDecorations(decorations: readonly Decoration[]): void {
  const view = useEditorView();

  useEffect(() => {
    if (!view) {
      return undefined;
    }
    view.setDecorations(decorations);
    return () => view.setDecorations([]);
  }, [view, decorations]);
}
