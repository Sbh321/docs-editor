import { useContext } from "react";

import { EditorViewContext } from "./editor-view-context";

import type { EditorView } from "@sbh321/docs-editor-core";

/**
 * The live `EditorView` mounted by the nearest `<Editor />`, or `null` until
 * one mounts (or if none is rendered). Use it to read caret coordinates
 * (`view.coordsAtPos`) for floating UI, or to refocus the editor after a
 * toolbar action. Returns `null` rather than throwing when there's no view, so
 * callers can render before the editor mounts.
 */
export function useEditorView(): EditorView | null {
  return useContext(EditorViewContext)?.view ?? null;
}
