import { createContext } from "react";

import type { EditorView } from "@sbh321/docs-editor-core";

/**
 * Lets the mounted `<Editor />` publish its live `EditorView` upward so
 * sibling UI (a floating toolbar, a slash menu) can read caret coordinates
 * and refocus the editor. Like {@link import("./editor-context").EditorStateContext},
 * it's typed against the default `<string, string>` instantiation — one fixed
 * `Context` can't vary its type parameters per usage.
 *
 * `view` is `null` until an `<Editor />` mounts and registers, and returns to
 * `null` when it unmounts, so consumers must handle its absence.
 */
export interface EditorViewRegistry {
  readonly view: EditorView | null;
  /** Called by `<Editor />` on mount/unmount. Not intended for application code. */
  readonly setView: (view: EditorView | null) => void;
}

export const EditorViewContext = createContext<EditorViewRegistry | null>(null);
