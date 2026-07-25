import { getOutline } from "@sbh321/docs-editor-core";
import { useMemo } from "react";

import { useEditorState } from "./use-editor-state";

import type { OutlineEntry, OutlineOptions } from "@sbh321/docs-editor-core";

/**
 * The document's heading structure (see the core `getOutline`), recomputed
 * only when the document changes. The data behind `OutlinePanel` and
 * `TableOfContents`; use it directly to build your own navigation.
 */
export function useOutline(options?: OutlineOptions): readonly OutlineEntry[] {
  const state = useEditorState();
  const headingType = options?.headingType;
  const levelAttr = options?.levelAttr;
  return useMemo(
    () =>
      getOutline(state.doc, {
        ...(headingType ? { headingType } : {}),
        ...(levelAttr ? { levelAttr } : {}),
      }),
    [state.doc, headingType, levelAttr],
  );
}
