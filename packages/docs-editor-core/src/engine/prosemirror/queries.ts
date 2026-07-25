import { fromEngineMark } from "./node-conversion";

import type { EngineState } from "./state";
import type { Mark } from "../../schema";
import type { Mark as ProseMirrorMark } from "prosemirror-model";

/**
 * The marks considered "active" for the current selection — what a toolbar
 * shows as pressed:
 *
 * - At a collapsed cursor: the marks that would apply to the next typed
 *   character (`storedMarks` if the user just toggled one, otherwise the
 *   marks stored at the cursor position).
 * - Over a range: only the marks that cover the *entire* selection (their
 *   intersection across every inline node) — a partially-bold selection
 *   reports bold as *not* active, matching how `toggleMark` would remove it.
 */
export function engineActiveMarks(state: EngineState): Mark[] {
  const selection = state.selection;
  if (selection.empty) {
    const marks = state.storedMarks ?? selection.$from.marks();
    return marks.map((mark) => fromEngineMark(mark));
  }

  let common: readonly ProseMirrorMark[] | null = null;
  state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (!node.isInline) {
      return true;
    }
    common =
      common === null
        ? node.marks
        : common.filter((mark) => node.marks.some((other) => other.eq(mark)));
    return true;
  });
  return (common ?? []).map((mark) => fromEngineMark(mark));
}

/**
 * The type and attributes of the textblock containing the selection's start —
 * what a toolbar reads to show the current block type (e.g. "Heading 2"). This
 * is the node directly containing the resolved start position (`$from.parent`):
 * for a cursor inside a paragraph's or heading's text, that's the paragraph or
 * heading itself.
 */
export function engineActiveBlock(state: EngineState): {
  readonly type: string;
  readonly attrs: Record<string, unknown>;
} {
  const parent = state.selection.$from.parent;
  return { type: parent.type.name, attrs: { ...parent.attrs } };
}
