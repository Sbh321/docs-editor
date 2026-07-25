import { NodeSelection, TextSelection } from "prosemirror-state";
import { CellSelection } from "prosemirror-tables";

import type { Selection } from "../../selection";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Selection as ProseMirrorSelection } from "prosemirror-state";

/** Converts a plain docs-editor {@link Selection} into a ProseMirror selection. */
export function toEngineSelection(
  doc: ProseMirrorNode,
  selection: Selection,
): ProseMirrorSelection {
  if (selection.type === "node") {
    // `anchor` is the position directly before the node; NodeSelection.create
    // resolves it to the node there. Throws if it doesn't point at a selectable
    // node, surfacing a bad selection rather than silently degrading it.
    return NodeSelection.create(doc, selection.anchor);
  }
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
  if (selection instanceof NodeSelection) {
    // `from`/`to` bracket the selected node; `from` is the position before it,
    // which toEngineSelection uses to rebuild the NodeSelection.
    return { anchor: selection.from, head: selection.to, type: "node" };
  }
  return { anchor: selection.anchor, head: selection.head };
}
