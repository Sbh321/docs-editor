import { TextSelection } from "prosemirror-state";
import { CellSelection } from "prosemirror-tables";

import type { Selection } from "../../selection";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Selection as ProseMirrorSelection } from "prosemirror-state";

/** Converts a plain docs-editor {@link Selection} into a ProseMirror selection. */
export function toEngineSelection(
  doc: ProseMirrorNode,
  selection: Selection,
): ProseMirrorSelection {
  if (selection.type === "cell") {
    // For a cell selection, anchor/head point *at* the cells (the position
    // directly before each), which is exactly what CellSelection.create
    // expects — it resolves them and rebuilds the rectangular range. Throws
    // if they don't resolve to cells, surfacing a bad selection rather than
    // silently degrading it.
    return CellSelection.create(doc, selection.anchor, selection.head);
  }
  return TextSelection.create(doc, selection.anchor, selection.head);
}

/** Converts a ProseMirror selection back into a plain docs-editor {@link Selection}. */
export function fromEngineSelection(selection: ProseMirrorSelection): Selection {
  if (selection instanceof CellSelection) {
    // A CellSelection's own anchor/head point at inner text positions of the
    // head cell, not the cells themselves — round-tripping must use the cell
    // positions ($anchorCell/$headCell) so toEngineSelection can rebuild it.
    return {
      anchor: selection.$anchorCell.pos,
      head: selection.$headCell.pos,
      type: "cell",
    };
  }
  return { anchor: selection.anchor, head: selection.head };
}
