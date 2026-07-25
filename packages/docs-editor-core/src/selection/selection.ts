/**
 * A selection is a range within the flattened document, addressed by linear
 * position (the same addressing scheme `EditorState`/`Transaction` use for
 * edit ranges). `anchor` is the immobile end, `head` is the end that moves
 * as the selection is extended — when they're equal the selection is a
 * collapsed cursor.
 *
 * `type` discriminates the selection kind:
 *
 * - `"text"` (the default when omitted) — an ordinary linear text selection;
 *   `anchor`/`head` are text positions.
 * - `"cell"` — a rectangular table-cell selection; `anchor`/`head` point at
 *   the anchor and head *cells* (each is the position directly before a
 *   cell), not text offsets. Produced by the engine's table support when the
 *   user selects across cells, and reconstructed as such when set back. The
 *   two cells must be in the same table; setting a `"cell"` selection whose
 *   positions don't resolve to cells fails predictably rather than silently
 *   degrading to a text selection.
 *
 * Deliberately plain data (no class, no engine dependency) so it has no
 * layering dependency on `../engine` or `../state` — both of those depend
 * on this module, not the other way around.
 */
export interface Selection {
  readonly anchor: number;
  readonly head: number;
  readonly type?: "text" | "cell";
}

/** The lower bound of the selection's range. */
export function selectionFrom(selection: Selection): number {
  return Math.min(selection.anchor, selection.head);
}

/** The upper bound of the selection's range. */
export function selectionTo(selection: Selection): number {
  return Math.max(selection.anchor, selection.head);
}

/** Whether the selection is a collapsed cursor (contains no content). */
export function isSelectionEmpty(selection: Selection): boolean {
  return selection.anchor === selection.head;
}
