/**
 * List node types and styles (ROADMAP Phase 9, Milestone 9.3).
 *
 * ## Why task lists are their own node types
 *
 * A `checked` flag on the existing `list_item` was the smaller change and the
 * wrong one. Every ordinary bullet would then carry `checked: null` — a field
 * that means nothing for it, that every exporter has to step around, and that
 * makes "is this a checklist?" a question about a child's attribute rather than
 * about the list. Markdown, DOCX and HTML each serialize a checklist
 * differently from a bullet list, so the distinction has to survive into the
 * model. `task_list` / `task_item` keeps it there.
 */

import type { AttributeSpec, NodeSpec } from "../schema";

/** Node names this module contributes. */
export const TASK_LIST_NODE = "task_list";
export const TASK_ITEM_NODE = "task_item";

/** The node names {@link taskListNodeSpecs} declares. */
export type TaskListNodeName = typeof TASK_LIST_NODE | typeof TASK_ITEM_NODE;

/** The attribute a task item carries. */
export const TASK_ITEM_CHECKED_ATTR = "checked";

/** The attribute both list types carry to choose their marker. */
export const LIST_STYLE_ATTR = "listStyle";

/**
 * Marker styles for a bullet list, in the order a picker should offer them.
 * These are CSS `list-style-type` values, so they render with no extra work.
 */
export const BULLET_LIST_STYLES = ["disc", "circle", "square"] as const;

/** Marker styles for a numbered list. */
export const ORDERED_LIST_STYLES = [
  "decimal",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
] as const;

export type BulletListStyle = (typeof BULLET_LIST_STYLES)[number];
export type OrderedListStyle = (typeof ORDERED_LIST_STYLES)[number];
export type ListStyle = BulletListStyle | OrderedListStyle;

/** Every marker style, for validation. */
export const LIST_STYLES: readonly ListStyle[] = [...BULLET_LIST_STYLES, ...ORDERED_LIST_STYLES];

/** Whether `value` is a marker style. */
export function isListStyle(value: unknown): value is ListStyle {
  return typeof value === "string" && (LIST_STYLES as readonly string[]).includes(value);
}

/**
 * The styles valid for a given list type — what a style picker offers, so it
 * cannot suggest roman numerals for a bullet list.
 */
export function listStylesFor(listType: string): readonly ListStyle[] {
  if (listType === "ordered_list") {
    return ORDERED_LIST_STYLES;
  }
  return BULLET_LIST_STYLES;
}

/**
 * The style attribute spec to spread into a list node's `attrs`.
 *
 * Defaults to `null`, not `"disc"`: an unset style should follow the
 * stylesheet, including whatever a nested level is styled as, while an explicit
 * `"disc"` should stay a disc at every depth. Defaulting to a concrete value
 * would freeze every list at level one's marker.
 */
export function listStyleAttrs(): Readonly<Record<string, AttributeSpec>> {
  return { [LIST_STYLE_ATTR]: { default: null } };
}

/**
 * The task list node specs, to spread into a schema's `nodes`.
 *
 * `task_item` mirrors `list_item`'s content (`paragraph block*`) so everything
 * that works inside a bullet — nested lists, multiple paragraphs — works inside
 * a checklist item too, and so converting between them never has to reshape
 * content.
 */
export function taskListNodeSpecs(): Record<TaskListNodeName, NodeSpec> {
  return {
    [TASK_LIST_NODE]: {
      group: "block",
      content: `${TASK_ITEM_NODE}+`,
    },
    [TASK_ITEM_NODE]: {
      content: "paragraph block*",
      attrs: { [TASK_ITEM_CHECKED_ATTR]: { default: false } },
    },
  };
}
