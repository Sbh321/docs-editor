/**
 * List commands (ROADMAP Phase 9, Milestone 9.3).
 *
 * `wrapInList` and the lift/sink/split trio have existed since Phase 3, but
 * they only ever *enter* or *nest* a list. What a toolbar needs is the toggle:
 * pressing "numbered list" while already in a bullet list should convert it,
 * and pressing it again should leave. Getting there through the existing
 * commands means lifting out and re-wrapping, which destroys nesting and the
 * selection along the way.
 *
 * `wrapInList` and `liftListItem` are imported by module path rather than
 * through `../commands`, which re-exports this module — a barrel import would
 * make the two mutually dependent.
 */

import { liftListItem, wrapInList } from "../commands/list-commands";
import { ancestors, nodeAt } from "../queries";
import { nodeSize } from "../schema";

import {
  isListStyle,
  LIST_STYLE_ATTR,
  TASK_ITEM_CHECKED_ATTR,
  TASK_ITEM_NODE,
  TASK_LIST_NODE,
} from "./list-node-specs";

import type { Dispatch } from "../commands";
import type { EditorState } from "../state";
import type { ListStyle } from "./list-node-specs";

/** How a list type pairs with its item type. */
export interface ListTypes {
  readonly list: string;
  readonly item: string;
}

/** The list types the preset ships, in the order a toolbar shows them. */
export const DEFAULT_LIST_TYPES: readonly ListTypes[] = [
  { list: "bullet_list", item: "list_item" },
  { list: "ordered_list", item: "list_item" },
  { list: TASK_LIST_NODE, item: TASK_ITEM_NODE },
];

export interface ToggleListOptions {
  /** Every list type/item pairing in this schema. Defaults to {@link DEFAULT_LIST_TYPES}. */
  readonly listTypes?: readonly ListTypes[];
  /** Attributes for a newly created list. */
  readonly attrs?: Record<string, unknown>;
}

/**
 * The list the selection is inside, or `null` — what a toolbar reads to show
 * which list button is pressed.
 *
 * Reports the **innermost** list, so a bullet list nested in a numbered one
 * lights the bullet button, matching what a conversion would act on.
 */
export function activeList<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  options: ToggleListOptions = {},
): { readonly type: string; readonly pos: number; readonly style: ListStyle | null } | null {
  const listTypes = options.listTypes ?? DEFAULT_LIST_TYPES;
  const names = listTypes.map((entry) => entry.list);
  const found = ancestors(state).find((ancestor) => names.includes(ancestor.type));
  if (!found) {
    return null;
  }
  const style = found.attrs[LIST_STYLE_ATTR];
  return { type: found.type, pos: found.pos, style: isListStyle(style) ? style : null };
}

/**
 * Turns the selection into a list of `listType`, converts it from another list
 * type, or lifts it out if it is already one — the single action a toolbar
 * button needs.
 *
 * Conversion changes the list node's *type in place* rather than unwrapping and
 * re-wrapping. That is the whole point: unwrapping flattens nested items and
 * moves the cursor, so a user converting a three-level outline to numbers would
 * watch it collapse.
 *
 * Reports `false` when the selection cannot become a list at all.
 */
export function toggleList(listType: string, options: ToggleListOptions = {}) {
  const listTypes = options.listTypes ?? DEFAULT_LIST_TYPES;

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const target = listTypes.find((entry) => entry.list === listType);
    if (!target || !(listType in state.schema.spec.nodes)) {
      return false;
    }

    const current = activeList(state, options);

    // Not in a list: wrap.
    if (current === null) {
      return wrapInList(listType, options.attrs)(state, dispatch);
    }

    // Already this kind of list: leave it.
    if (current.type === listType) {
      const currentItem = listTypes.find((entry) => entry.list === current.type)?.item;
      return currentItem === undefined ? false : liftListItem(currentItem)(state, dispatch);
    }

    // A different kind: convert in place.
    return convertList(state, dispatch, current.pos, current.type, target, listTypes);
  };
}

/**
 * Rewrites a list to a different type.
 *
 * Two paths, because the engine validates **every step** rather than only the
 * final document — and when the item types differ there is no valid ordering of
 * two `setNodeType` calls. Changing the list first leaves a `task_list` holding
 * `list_item`s; changing the items first leaves a `bullet_list` holding
 * `task_item`s. Both are rejected.
 *
 * So when only the wrapper changes, one `setNodeType` does it and nothing else
 * in the document moves. When the items change too, the list is replaced in a
 * single step by an equivalent one — the item *content* is reused, so
 * paragraphs and any nested lists inside them carry across untouched.
 */
function convertList<NodeName extends string, MarkName extends string>(
  state: EditorState<NodeName, MarkName>,
  dispatch: Dispatch<NodeName> | undefined,
  listPos: number,
  fromType: string,
  target: ListTypes,
  listTypes: readonly ListTypes[],
): boolean {
  const fromItem = listTypes.find((entry) => entry.list === fromType)?.item;
  if (fromItem === undefined || !(target.item in state.schema.spec.nodes)) {
    return false;
  }
  const listNode = nodeAt(state, listPos);
  if (!listNode) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;
    const listAttrs = state.schema.blockType(target.list as NodeName, {}).attrs;

    if (fromItem === target.item) {
      tr.setNodeType(listPos, target.list as NodeName, listAttrs);
    } else {
      const items = listNode.content.map((item) =>
        state.schema.node(target.item as NodeName, undefined, item.content),
      );
      const replacement = state.schema.node(target.list as NodeName, listAttrs, items);
      tr.insertNode(replacement, listPos, listPos + nodeSize(listNode, state.schema));
    }
    dispatch(tr);
  }
  return true;
}

/**
 * Sets the marker style on the list the selection is in.
 *
 * Reports `false` outside a list, and when the style is already applied.
 */
export function setListStyle(style: ListStyle | null, options: ToggleListOptions = {}) {
  if (style !== null && !isListStyle(style)) {
    throw new TypeError(`Invalid list style "${String(style)}".`);
  }

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const current = activeList(state, options);
    if (current === null || current.style === style) {
      return false;
    }
    const declared = state.schema.spec.nodes[current.type as NodeName]?.attrs;
    if (!declared || !(LIST_STYLE_ATTR in declared)) {
      return false;
    }

    if (dispatch) {
      const node = nodeAt(state, current.pos);
      const attrs = { ...node?.attrs, [LIST_STYLE_ATTR]: style };
      const validated = state.schema.blockType(current.type as NodeName, attrs);
      dispatch(state.tr.setNodeAttrs(current.pos, validated.attrs));
    }
    return true;
  };
}

/**
 * Checks or unchecks the task item the selection is in.
 *
 * Pass `checked` to set it explicitly — a checkbox click knows the value it
 * wants, and toggling from a stale read is how a double-click ends up undoing
 * itself.
 */
export function toggleTaskItem(checked?: boolean, options: { readonly itemType?: string } = {}) {
  const itemType = options.itemType ?? TASK_ITEM_NODE;

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const item = ancestors(state).find((ancestor) => ancestor.type === itemType);
    if (!item) {
      return false;
    }
    const next = checked ?? item.attrs[TASK_ITEM_CHECKED_ATTR] !== true;
    if (next === item.attrs[TASK_ITEM_CHECKED_ATTR]) {
      return false;
    }

    if (dispatch) {
      const attrs = { ...item.attrs, [TASK_ITEM_CHECKED_ATTR]: next };
      const validated = state.schema.blockType(itemType as NodeName, attrs);
      dispatch(state.tr.setNodeAttrs(item.pos, validated.attrs));
    }
    return true;
  };
}

/** Whether the task item at the selection is checked, or `null` outside one. */
export function activeTaskItem<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  options: { readonly itemType?: string } = {},
): { readonly checked: boolean; readonly pos: number } | null {
  const itemType = options.itemType ?? TASK_ITEM_NODE;
  const item = ancestors(state).find((ancestor) => ancestor.type === itemType);
  return item ? { checked: item.attrs[TASK_ITEM_CHECKED_ATTR] === true, pos: item.pos } : null;
}
