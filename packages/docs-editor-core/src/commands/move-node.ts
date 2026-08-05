/**
 * Moving a node (ROADMAP Phase 9, Milestone 9.4).
 *
 * The model half of drag-to-reorder. Deliberately position-based and free of
 * any notion of dragging: a pointer gesture, a keyboard shortcut and a
 * programmatic reorder all want the same edit, and only one of them involves a
 * mouse.
 */

import { ancestors, nodeAt } from "../queries";
import { nodeSize } from "../schema";

import type { EditorState } from "../state";
import type { Dispatch } from "./types";

/**
 * Moves the node starting at `from` so that it begins at `to`.
 *
 * Both are positions *before* a node, as reported by
 * {@link import("../queries").ancestors} and
 * {@link import("../queries").textblocksInSelection}.
 *
 * Reports `false` when there is no node at `from`, when `to` falls inside the
 * node being moved (a node cannot contain itself), and when the move would
 * change nothing.
 */
export function moveNode(from: number, to: number) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const node = nodeAt(state, from);
    if (!node) {
      return false;
    }
    const size = nodeSize(node, state.schema);

    // Dropping a node onto its own start or end is a no-op, and dropping it
    // *inside* itself is not a move at all.
    if (to >= from && to <= from + size) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;
      tr.delete(from, from + size);
      // After the delete, everything past the removed range has shifted left by
      // its size — so a target that was after the node needs adjusting, and one
      // before it does not.
      const target = to > from ? to - size : to;
      tr.insertNode(node, target, target);
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Moves the top-level block containing the selection up or down by one sibling.
 *
 * The **keyboard** route to reordering. A drag handle is a pointer-only
 * affordance, and CLAUDE.md treats an accessibility regression as a bug, so the
 * same operation has to be reachable without one.
 *
 * Reports `false` at the ends of the document, so the key falls through rather
 * than appearing to work.
 */
export function moveBlock(direction: "up" | "down") {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    // The outermost ancestor — `ancestors` reports innermost first, so the last
    // entry is the top-level block. Moving the *innermost* node would drag a
    // paragraph out of its list item, which is not what the gesture means.
    const chain = ancestors(state);
    const block = chain[chain.length - 1];
    if (!block) {
      return false;
    }

    const siblings = state.doc.content;
    let offset = 0;
    const positions: number[] = [];
    for (const child of siblings) {
      positions.push(offset);
      offset += nodeSize(child, state.schema);
    }

    const index = positions.indexOf(block.pos);
    if (index === -1) {
      return false;
    }

    if (direction === "up") {
      const previous = positions[index - 1];
      return previous === undefined ? false : moveNode(block.pos, previous)(state, dispatch);
    }

    const next = siblings[index + 1];
    const nextPos = positions[index + 1];
    if (next === undefined || nextPos === undefined) {
      return false;
    }
    // Past the following sibling's end, which after the move is where this
    // block should start.
    return moveNode(block.pos, nextPos + nodeSize(next, state.schema))(state, dispatch);
  };
}

/**
 * The top-level blocks, with the position and size each occupies.
 *
 * What a drop-indicator needs: a view can map each entry to a rendered element
 * and decide which gap the pointer is nearest, without doing position
 * arithmetic of its own.
 */
export function topLevelBlocks<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
): readonly { readonly pos: number; readonly size: number; readonly type: NodeName }[] {
  const out: { pos: number; size: number; type: NodeName }[] = [];
  let offset = 0;
  for (const child of state.doc.content) {
    const size = nodeSize(child, state.schema);
    out.push({ pos: offset, size, type: child.type });
    offset += size;
  }
  return out;
}
