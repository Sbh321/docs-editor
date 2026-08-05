/**
 * Clear formatting (ROADMAP Phase 9, Milestone 9.2).
 *
 * {@link import("../commands").removeFormatting} clears marks and stops there,
 * which was complete while marks were the only formatting the model could
 * carry. Phase 9 added block attributes, so a centred, indented, bold paragraph
 * run through it comes back still centred and still indented — formatting that
 * visibly survived a button labelled "clear formatting".
 *
 * This is the whole-meaning version, and it builds **one** transaction rather
 * than chaining two commands: clearing marks and resetting attributes are
 * separate edits, and dispatching them separately would make undo take two
 * presses to get back where the user started.
 *
 * Block *type* is deliberately left alone. A heading is structure, not styling
 * — it carries into the outline, the table of contents and every export — so
 * demoting one would destroy more than formatting. Word and Google Docs draw
 * the line in the same place. A consumer who wants otherwise composes
 * `setBlockType("paragraph")` alongside this.
 */

import { textblocksInSelection } from "../queries";
import { isSelectionEmpty, selectionFrom, selectionTo } from "../selection";

import { PARAGRAPH_FORMATTING_ATTRS } from "./paragraph-formatting";

import type { Dispatch } from "../commands";
import type { EditorState } from "../state";

/** The attributes cleared, and the value each returns to. */
const CLEARED_ATTRS: Readonly<Record<string, unknown>> = {
  [PARAGRAPH_FORMATTING_ATTRS.align]: null,
  [PARAGRAPH_FORMATTING_ATTRS.indent]: 0,
};

/**
 * Removes every mark and resets alignment and indentation across the selection.
 *
 * Reports `false` when there is nothing to clear, so a toolbar button disables
 * itself by dry-running it.
 *
 * Note the deliberate asymmetry with `removeFormatting`, which declines at a
 * collapsed cursor: a cursor with no range still clears *block* formatting,
 * because alignment applies to the whole block the cursor sits in and needs no
 * range to be meaningful.
 */
export function clearFormatting<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  const { selection } = state;
  const hasRange = !isSelectionEmpty(selection);
  const blocks = clearableBlocks(state);

  if (!hasRange && blocks.length === 0) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;
    if (hasRange) {
      tr.removeMark(selectionFrom(selection), selectionTo(selection), null);
    }
    for (const block of blocks) {
      tr.setNodeAttrs(block.pos, block.attrs);
    }
    dispatch(tr);
  }
  return true;
}

/**
 * The blocks whose attributes would actually change, with the validated
 * attributes to write.
 *
 * Computed before dispatching so a collapsed cursor in an already-clean
 * paragraph reports `false` rather than dispatching an empty transaction, which
 * would add a no-op step to the undo history.
 */
function clearableBlocks<NodeName extends string, MarkName extends string>(
  state: EditorState<NodeName, MarkName>,
): { pos: number; attrs: Record<string, unknown> }[] {
  const changes: { pos: number; attrs: Record<string, unknown> }[] = [];

  for (const block of textblocksInSelection(state)) {
    const type = block.type as NodeName;
    const declared = state.schema.spec.nodes[type]?.attrs;
    const attrs = { ...block.attrs };
    let changed = false;

    for (const [name, reset] of Object.entries(CLEARED_ATTRS)) {
      // A block type that never declared `align` is not an error — it simply is
      // not alignable, and skipping it lets a mixed selection clear the rest.
      if (declared === undefined || !(name in declared) || block.attrs[name] === reset) {
        continue;
      }
      attrs[name] = reset;
      changed = true;
    }

    if (changed) {
      changes.push({ pos: block.pos, attrs: state.schema.blockType(type, attrs).attrs });
    }
  }
  return changes;
}
