/**
 * Paragraph formatting — alignment and indentation (ROADMAP Phase 9,
 * Milestone 9.1).
 *
 * Both are **block attributes**, not marks. A mark can cover half a paragraph,
 * and "the left half of this paragraph is centred" has no meaning; alignment
 * and indentation describe a whole block, so the model should only be able to
 * express them that way.
 *
 * Like the media commands, these are ordinary commands over the existing
 * `Transaction` primitives, and every attribute change is re-validated through
 * `Schema.blockType()` before it reaches the document.
 *
 * The list commands are imported by module path rather than through
 * `../commands`, which re-exports this module — a barrel import would make the
 * two mutually dependent.
 */

import { liftListItem, sinkListItem } from "../commands/list-commands";
import { textblocksInSelection } from "../queries";

import type { Dispatch } from "../commands";
import type { AttributeSpec } from "../schema";
import type { EditorState } from "../state";

/** The alignments a block may carry. */
export const TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;

/** A value in {@link TEXT_ALIGNMENTS}. */
export type TextAlign = (typeof TEXT_ALIGNMENTS)[number];

/** Whether `value` is a {@link TextAlign}. */
export function isTextAlign(value: unknown): value is TextAlign {
  return typeof value === "string" && (TEXT_ALIGNMENTS as readonly string[]).includes(value);
}

/**
 * Attribute names paragraph formatting uses, named once so a renderer, parse
 * rule and exporter cannot drift apart over a spelling.
 */
export const PARAGRAPH_FORMATTING_ATTRS = {
  align: "align",
  indent: "indent",
} as const;

/**
 * The deepest level {@link indent} will produce.
 *
 * A limit exists because indentation consumes horizontal space that the page
 * width does not grow to match — past some depth a block indents itself off the
 * page entirely. Eight is deeper than real documents nest and still fits an A4
 * page at the default margin.
 */
export const MAX_INDENT = 8;

/**
 * Node types {@link indent} nests instead of indenting by attribute.
 *
 * Covers the preset's own list items. A consumer whose items are named
 * differently passes its own through {@link IndentOptions.listItemTypes}.
 */
export const DEFAULT_LIST_ITEM_TYPES: readonly string[] = ["list_item", "task_item"];

/**
 * The attribute specs a block node needs to be alignable and indentable.
 * Spread into a node spec's `attrs`, as `mediaNodeSpecs()` is spread into a
 * schema's nodes:
 *
 * ```ts
 * paragraph: { group: "block", content: "inline*", attrs: { ...paragraphFormattingAttrs() } }
 * ```
 *
 * `align` defaults to `null`, not `"left"`. The two are different: a block that
 * was never aligned should follow the page's direction — right-to-left included
 * — while one explicitly set to `"left"` should stay left even inside a
 * right-aligned parent. Defaulting to `"left"` would make every untouched
 * paragraph in an RTL document silently wrong.
 */
export function paragraphFormattingAttrs(): Readonly<Record<string, AttributeSpec>> {
  return {
    [PARAGRAPH_FORMATTING_ATTRS.align]: { default: null },
    [PARAGRAPH_FORMATTING_ATTRS.indent]: { default: 0 },
  };
}

/**
 * The alignment shared by every textblock in the selection, or `null` when they
 * disagree or none is set — what an alignment button reads to show itself
 * pressed.
 *
 * A mixed selection reports `null` rather than the first block's value,
 * matching how {@link import("../queries").activeMarks} treats a partially-bold
 * range. A button lit up for a selection it does not entirely describe would
 * lie about what pressing it again would do.
 */
export function textAlign<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
): TextAlign | null {
  const blocks = textblocksInSelection(state);
  const first = blocks[0]?.attrs[PARAGRAPH_FORMATTING_ATTRS.align];
  if (blocks.length === 0 || !isTextAlign(first)) {
    return null;
  }
  return blocks.every((block) => block.attrs[PARAGRAPH_FORMATTING_ATTRS.align] === first)
    ? first
    : null;
}

/**
 * The indent level of the textblock at the selection's start, or `0`.
 *
 * Unlike {@link textAlign} this reports the first block rather than requiring
 * agreement: indent controls are *relative* ("one deeper"), so they never
 * render a particular level as active. This exists for readouts and for
 * deciding whether decreasing is still possible.
 */
export function blockIndent<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
): number {
  return toIndent(textblocksInSelection(state)[0]?.attrs[PARAGRAPH_FORMATTING_ATTRS.indent]);
}

/**
 * Aligns every textblock the selection touches. Pass `null` to clear the
 * alignment and fall back to the page's direction.
 *
 * Reports `false` when no block in the selection declares an `align` attribute
 * — so a toolbar button disables itself by dry-running it — and when every
 * block already carries this alignment, so pressing it twice does not stack
 * identical entries onto the undo history.
 */
export function setTextAlign(align: TextAlign | null) {
  if (align !== null && !isTextAlign(align)) {
    // A programmer error, not user input: fail at the call site rather than
    // writing an unrenderable value into the document.
    throw new TypeError(
      `Invalid text alignment "${String(align)}". Expected one of: ${TEXT_ALIGNMENTS.join(", ")}, or null.`,
    );
  }
  return setBlockAttrs({ [PARAGRAPH_FORMATTING_ATTRS.align]: () => align });
}

export interface IndentOptions {
  /**
   * Node types treated as list items — nested rather than indented by
   * attribute. Defaults to {@link DEFAULT_LIST_ITEM_TYPES}.
   */
  readonly listItemTypes?: readonly string[];
  /** Deepest level {@link indent} will reach. Defaults to {@link MAX_INDENT}. */
  readonly maxIndent?: number;
}

/**
 * Increases indentation: nesting inside a list, and raising the `indent`
 * attribute everywhere else.
 *
 * **Why one command rather than two.** An `indent` attribute on a list item
 * would render as indented while leaving the item a structural *sibling* of the
 * one above it. The document would look right and be wrong — the outline,
 * Markdown and DOCX all read structure rather than style, so the exported file
 * would not match the screen. Nesting is what indentation *means* inside a
 * list, and this picks the meaning that fits where the cursor is.
 *
 * Reports `false` when nothing can indent: already at {@link MAX_INDENT}, or in
 * a block whose type declares no `indent` attribute.
 */
export function indent(options: IndentOptions = {}) {
  const { maxIndent = MAX_INDENT } = options;
  const shift = setBlockAttrs({
    [PARAGRAPH_FORMATTING_ATTRS.indent]: (current) => Math.min(maxIndent, toIndent(current) + 1),
  });
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => nestListItem(state, dispatch, options, "sink") || shift(state, dispatch);
}

/**
 * Decreases indentation: lifting out of a list, and lowering the `indent`
 * attribute everywhere else. The inverse of {@link indent} — see it for why the
 * two behaviours share one command.
 *
 * Reports `false` at level 0 outside a list, so the key can fall through to
 * whatever else is bound to it.
 */
export function outdent(options: IndentOptions = {}) {
  const shift = setBlockAttrs({
    [PARAGRAPH_FORMATTING_ATTRS.indent]: (current) => Math.max(0, toIndent(current) - 1),
  });
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => nestListItem(state, dispatch, options, "lift") || shift(state, dispatch);
}

/**
 * Resets alignment and indentation on every textblock in the selection.
 *
 * The block half of "clear formatting".
 * {@link import("../commands").removeFormatting} clears marks, which leaves a
 * centred, indented paragraph centred and indented — see
 * {@link import("../commands").clearFormatting}, which composes both into the
 * behaviour the phrase implies.
 */
export function clearParagraphFormatting<
  NodeName extends string = string,
  MarkName extends string = string,
>(state: EditorState<NodeName, MarkName>, dispatch?: Dispatch<NodeName>): boolean {
  return CLEAR_PARAGRAPH_FORMATTING(state, dispatch);
}

const CLEAR_PARAGRAPH_FORMATTING = setBlockAttrs({
  [PARAGRAPH_FORMATTING_ATTRS.align]: () => null,
  [PARAGRAPH_FORMATTING_ATTRS.indent]: () => 0,
});

/** Tries to nest or unnest a list item, taking the first candidate type that applies. */
function nestListItem<NodeName extends string, MarkName extends string>(
  state: EditorState<NodeName, MarkName>,
  dispatch: Dispatch<NodeName> | undefined,
  options: IndentOptions,
  direction: "sink" | "lift",
): boolean {
  const { listItemTypes = DEFAULT_LIST_ITEM_TYPES } = options;
  for (const itemType of listItemTypes) {
    // Only types this schema declares. Asking for a missing one would throw out
    // of a command that should simply not apply here.
    if (!(itemType in state.schema.spec.nodes)) {
      continue;
    }
    const command = direction === "sink" ? sinkListItem(itemType) : liftListItem(itemType);
    if (command(state, dispatch)) {
      return true;
    }
  }
  return false;
}

/**
 * Sets attributes on every textblock in the selection that declares them, in a
 * single transaction.
 *
 * Positions stay valid across the loop because changing attributes never
 * changes a node's size — so nothing needs mapping through the transaction, and
 * one undo step covers the whole selection.
 *
 * Returns a generic function rather than a `Command`: a concrete
 * `Command`-typed value is pinned to `Dispatch<string>` and could not accept a
 * caller's `Dispatch<NodeName>`. Same reason as
 * {@link import("../commands").toggleMark}.
 */
function setBlockAttrs(updates: Readonly<Record<string, (current: unknown) => unknown>>) {
  const names = Object.keys(updates);

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const changes: { pos: number; type: NodeName; attrs: Record<string, unknown> }[] = [];

    for (const block of textblocksInSelection(state)) {
      const type = block.type as NodeName;
      const declared = state.schema.spec.nodes[type]?.attrs;
      // A code block that declares no `align` is not an error, it just is not
      // alignable — skip it rather than failing the command, so aligning a
      // mixed selection still aligns the blocks that can be.
      const applicable = names.filter((name) => declared !== undefined && name in declared);
      if (applicable.length === 0) {
        continue;
      }

      const attrs = { ...block.attrs };
      let changed = false;
      for (const name of applicable) {
        const value = updates[name]?.(block.attrs[name]);
        if (value !== block.attrs[name]) {
          attrs[name] = value;
          changed = true;
        }
      }
      if (changed) {
        changes.push({ pos: block.pos, type, attrs });
      }
    }

    if (changes.length === 0) {
      return false;
    }
    if (dispatch) {
      const tr = state.tr;
      for (const change of changes) {
        // Re-validated as a whole set, so a partial update can neither drop an
        // attribute nor smuggle past a value the schema would reject.
        tr.setNodeAttrs(change.pos, state.schema.blockType(change.type, change.attrs).attrs);
      }
      dispatch(tr);
    }
    return true;
  };
}

function toIndent(current: unknown): number {
  return typeof current === "number" && Number.isFinite(current) ? Math.max(0, current) : 0;
}
