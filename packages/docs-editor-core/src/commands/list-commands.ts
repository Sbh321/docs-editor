import {
  runEngineLiftListItem,
  runEngineSinkListItem,
  runEngineSplitListItem,
  runEngineWrapInList,
} from "../engine";

import { adaptDispatch } from "./adapt-dispatch";

import type { EditorState } from "../state";
import type { Dispatch } from "./types";

/**
 * These wrap `prosemirror-schema-list` (via `../engine`) — list-specific
 * structural edits that `prosemirror-commands`' generic `wrapIn`/`lift`
 * don't cover, since they need to know which node type represents a list
 * item to work correctly. See {@link toggleMark} (in `./built-ins`) for why
 * type names are plain `string`s and the returned functions are generic.
 */

/** Wraps the textblocks touched by the selection in a new list of `listType` (e.g. `"bullet_list"`). */
export function wrapInList(listType: string, attrs?: Record<string, unknown>) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const blockType = state.schema.blockType(listType as NodeName, attrs);
    return runEngineWrapInList(
      state.engine,
      blockType.type,
      blockType.attrs,
      adaptDispatch(dispatch),
    );
  };
}

/**
 * Splits a non-empty textblock at the top level of a list item of `itemType`
 * (e.g. `"list_item"`), also splitting the item — the list-aware
 * counterpart of pressing Enter, so a new list item is created instead of a
 * second paragraph inside the same one.
 */
export function splitListItem(itemType: string) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => runEngineSplitListItem(state.engine, itemType, adaptDispatch(dispatch));
}

/** Lifts the list item of `itemType` around the selection out of its wrapping list. */
export function liftListItem(itemType: string) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => runEngineLiftListItem(state.engine, itemType, adaptDispatch(dispatch));
}

/** Sinks the list item of `itemType` around the selection into an inner (nested) list. */
export function sinkListItem(itemType: string) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => runEngineSinkListItem(state.engine, itemType, adaptDispatch(dispatch));
}
