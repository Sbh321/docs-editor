import { selectionFrom, selectionTo } from "@sbh321/docs-editor-core";

import type { EditorView, Selection } from "@sbh321/docs-editor-core";

/** A `getBoundingClientRect`-compatible rectangle, the shape Floating UI's virtual elements need. */
export interface ClientRectLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const EMPTY_RECT: ClientRectLike = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/**
 * The viewport rectangle spanning `selection` in `view`, built from the caret
 * coordinates at its endpoints — the anchor for a floating selection toolbar.
 * Returns a zero rect if the view can't resolve the positions yet (e.g. mid
 * remount), so callers get a stable object rather than a throw.
 */
export function selectionRect(view: EditorView, selection: Selection): ClientRectLike {
  try {
    const start = view.coordsAtPos(selectionFrom(selection));
    const end = view.coordsAtPos(selectionTo(selection));
    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    return { x: left, y: top, width: right - left, height: bottom - top, top, right, bottom, left };
  } catch {
    return EMPTY_RECT;
  }
}

/** A zero-size viewport rectangle at a single point — the anchor for a menu opened at the caret or pointer. */
export function pointRect(x: number, y: number): ClientRectLike {
  return { x, y, width: 0, height: 0, top: y, right: x, bottom: y, left: x };
}
