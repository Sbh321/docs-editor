import { tableEditing } from "prosemirror-tables";

import type { Plugin } from "prosemirror-state";

/**
 * Builds the ProseMirror plugin that powers interactive table editing —
 * rectangular cell selection (drag / Shift-arrow), arrow-key navigation
 * across cells, and automatic repair of malformed tables after edits. It's
 * required for cell selections to be created at all in a live view; the table
 * *commands* (add/remove row/column, merge, ...) also assume a document whose
 * tables this plugin keeps well-formed.
 *
 * Kept behind {@link EditorState.create}'s `tables` option (the same opt-in
 * shape as `history`) rather than always installed, so a schema with no table
 * nodes carries none of this machinery — and so ProseMirror's plugin system
 * stays fully internal, never crossing the package boundary.
 */
export function createEngineTablePlugin(): Plugin {
  return tableEditing();
}
