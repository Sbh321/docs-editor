import { NodeSelection } from "prosemirror-state";

import { fromEngineMark, fromEngineNode } from "./node-conversion";

import type { EngineState } from "./state";
import type { DocumentNode, Mark } from "../../schema";
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

/**
 * The node starting at `pos`, or `null` when nothing starts exactly there.
 *
 * `pos` is the position directly *before* a node — the same addressing
 * `Transaction.setNodeAttrs` and the ancestor/textblock queries use — so a
 * position obtained from one of those can be resolved back to its node without
 * the caller re-walking the document.
 */
export function engineNodeAt<NodeName extends string = string>(
  state: EngineState,
  pos: number,
): DocumentNode<NodeName> | null {
  const node = pos >= 0 && pos < state.doc.content.size ? state.doc.nodeAt(pos) : null;
  return node ? fromEngineNode<NodeName>(node) : null;
}

/** One ancestor of the selection, as {@link engineAncestorsAtSelection} reports it. */
export interface EngineAncestor {
  /** Position directly before the node — what `Transaction.setNodeAttrs` takes. */
  readonly pos: number;
  readonly type: string;
  readonly attrs: Record<string, unknown>;
  /** Nesting depth, 1 being a direct child of the document. */
  readonly depth: number;
}

/**
 * The chain of nodes containing the selection's start, innermost first.
 *
 * Structural commands need this. Converting a bullet list to a numbered one
 * means finding *which* list the cursor is in and how deep — a nested list
 * inside another must convert the inner one, not the outer — and neither
 * {@link engineActiveBlock} (the textblock only) nor
 * {@link engineSelectedNode} (node selections only) can answer that.
 *
 * The document itself is excluded: depth 0 is not a meaningful ancestor.
 */
export function engineAncestorsAtSelection(state: EngineState): readonly EngineAncestor[] {
  const $pos = state.selection.$from;
  const ancestors: EngineAncestor[] = [];
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    ancestors.push({
      pos: $pos.before(depth),
      type: node.type.name,
      attrs: { ...node.attrs },
      depth,
    });
  }
  return ancestors;
}

/** A contiguous run of one mark type, as {@link engineMarkRangeAtSelection} reports it. */
export interface EngineMarkRange {
  readonly from: number;
  readonly to: number;
  readonly attrs: Record<string, unknown>;
  /** The plain text the run covers — what a link editor shows as "display text". */
  readonly text: string;
}

/**
 * The full extent of the `markType` run the selection sits in, or `null`.
 *
 * A link editor needs this and cannot get it from
 * {@link engineActiveMarks}: with the cursor in the middle of a link, the mark
 * is active but its *boundaries* are unknown, and editing a link means
 * replacing all of it rather than the zero-width slice under the cursor.
 *
 * The run is walked outward through adjacent inline nodes carrying an equal
 * mark, so a link split by a bold word inside it still reports as one range.
 */
export function engineMarkRangeAtSelection(
  state: EngineState,
  markType: string,
): EngineMarkRange | null {
  const type = state.doc.type.schema.marks[markType];
  if (!type) {
    return null;
  }

  const $pos = state.selection.$from;
  const parent = $pos.parent;
  // `childAfter` first, then `childBefore`: with the cursor at a link's trailing
  // edge there is no node after it carrying the mark, but a user who clicked at
  // the end of link text still means that link.
  const candidates = [parent.childAfter($pos.parentOffset), parent.childBefore($pos.parentOffset)];

  for (const candidate of candidates) {
    const node = candidate.node;
    const mark = node?.marks.find((entry) => entry.type === type);
    if (!node || !mark) {
      continue;
    }

    let startIndex = candidate.index;
    let endIndex = candidate.index + 1;
    let from = $pos.start() + candidate.offset;
    let to = from + node.nodeSize;

    while (startIndex > 0 && mark.isInSet(parent.child(startIndex - 1).marks)) {
      startIndex -= 1;
      from -= parent.child(startIndex).nodeSize;
    }
    while (endIndex < parent.childCount && mark.isInSet(parent.child(endIndex).marks)) {
      to += parent.child(endIndex).nodeSize;
      endIndex += 1;
    }

    return { from, to, attrs: { ...mark.attrs }, text: state.doc.textBetween(from, to) };
  }

  return null;
}

/** One textblock's location and current state, as {@link engineTextblocksInSelection} reports it. */
export interface EngineTextblock {
  /** Position directly before the node — what `Transaction.setNodeAttrs` expects. */
  readonly pos: number;
  readonly type: string;
  readonly attrs: Record<string, unknown>;
}

/**
 * Every textblock the selection touches, in document order.
 *
 * {@link engineActiveBlock} reports only the block at the selection's *start*,
 * which is right for a toolbar showing "Heading 2" but wrong for applying a
 * change: a selection dragged across four paragraphs must align all four. This
 * is the read half of paragraph formatting.
 *
 * Textblocks cannot nest, so the walk stops descending as soon as it finds one —
 * without that, the inline text nodes inside each block would be visited for
 * nothing.
 */
export function engineTextblocksInSelection(state: EngineState): readonly EngineTextblock[] {
  const { from, to } = state.selection;
  const blocks: EngineTextblock[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) {
      return true;
    }
    blocks.push({ pos, type: node.type.name, attrs: { ...node.attrs } });
    return false;
  });
  return blocks;
}

/**
 * The node the selection covers *as a unit* (a `NodeSelection` — e.g. a clicked
 * image), together with its position range and its parent's.
 *
 * Returns `null` for an ordinary text selection. The parent information is what
 * lets a caller reason about structure without re-deriving positions: removing
 * an image inside a `figure`, for instance, has to remove the figure too, since
 * a figure with no media no longer satisfies its content expression.
 */
export function engineSelectedNode<NodeName extends string = string>(
  state: EngineState,
): SelectedEngineNode<NodeName> | null {
  const { selection } = state;
  if (!(selection instanceof NodeSelection)) {
    return null;
  }

  const from = selection.from;
  const node = selection.node;
  const resolved = state.doc.resolve(from);
  // Depth 0 is the document itself, which is not a meaningful "parent" here.
  const parent =
    resolved.depth > 0
      ? {
          node: fromEngineNode<NodeName>(resolved.parent),
          from: resolved.before(resolved.depth),
          to: resolved.after(resolved.depth),
          index: resolved.index(resolved.depth),
        }
      : null;

  return {
    node: fromEngineNode<NodeName>(node),
    from,
    to: from + node.nodeSize,
    parent,
  };
}

/** The shape {@link engineSelectedNode} returns. */
export interface SelectedEngineNode<NodeName extends string = string> {
  readonly node: DocumentNode<NodeName>;
  /** Position directly before the node. */
  readonly from: number;
  /** Position directly after the node. */
  readonly to: number;
  /** The containing node, or `null` when the node sits at the document root. */
  readonly parent: {
    readonly node: DocumentNode<NodeName>;
    readonly from: number;
    readonly to: number;
    /** This node's index among the parent's children. */
    readonly index: number;
  } | null;
}

/**
 * The first node whose `attr` equals `value`, with its position, or `null`.
 *
 * Searching by attribute rather than remembering a position is what makes
 * asynchronous work land correctly: between starting an upload and it
 * resolving, the user may have typed above the node, inserted blocks, or undone
 * something, so any position captured at the start is stale by the time it is
 * needed. The engine walk resolves the node's *current* location — and returns
 * the node with it, so callers never have to re-derive position arithmetic
 * (which differs for text nodes) by hand.
 */
export function engineFindNodeByAttr<NodeName extends string = string>(
  state: EngineState,
  attr: string,
  value: unknown,
): { readonly node: DocumentNode<NodeName>; readonly pos: number } | null {
  let found: { node: DocumentNode<NodeName>; pos: number } | null = null;
  state.doc.descendants((node, pos) => {
    if (found !== null) {
      return false;
    }
    if (node.attrs[attr] === value) {
      found = { node: fromEngineNode<NodeName>(node), pos };
      return false;
    }
    return true;
  });
  return found;
}
