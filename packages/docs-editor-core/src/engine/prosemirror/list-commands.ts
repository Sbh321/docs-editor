import {
  liftListItem as proseMirrorLiftListItem,
  sinkListItem as proseMirrorSinkListItem,
  splitListItem as proseMirrorSplitListItem,
  wrapInList as proseMirrorWrapInList,
} from "prosemirror-schema-list";

import { EngineConversionError } from "../errors";

import type { EngineState, EngineTransaction } from "./state";

type EngineDispatch = (transaction: EngineTransaction) => void;

/**
 * These wrap `prosemirror-schema-list`, a first-party ProseMirror package —
 * same reasoning as `./commands.ts`, but for list-specific structural edits
 * (splitting/lifting/sinking a list item) that `prosemirror-commands`
 * doesn't cover, since they need to know which node type represents a list
 * item to work correctly.
 */

function requireNodeType(state: EngineState, nodeType: string, commandName: string) {
  const engineNodeType = state.schema.nodes[nodeType];
  if (!engineNodeType) {
    throw new EngineConversionError(`Unknown node type "${nodeType}" when running ${commandName}.`);
  }
  return engineNodeType;
}

export function runEngineWrapInList(
  state: EngineState,
  listType: string,
  attrs: Record<string, unknown> | undefined,
  dispatch?: EngineDispatch,
): boolean {
  const engineListType = requireNodeType(state, listType, "wrapInList");
  return proseMirrorWrapInList(engineListType, attrs ?? null)(state, dispatch);
}

/** Splits a non-empty textblock at the top level of a list item, also splitting the item itself. */
export function runEngineSplitListItem(
  state: EngineState,
  itemType: string,
  dispatch?: EngineDispatch,
): boolean {
  const engineItemType = requireNodeType(state, itemType, "splitListItem");
  return proseMirrorSplitListItem(engineItemType)(state, dispatch);
}

/** Lifts the list item around the selection out of its wrapping list. */
export function runEngineLiftListItem(
  state: EngineState,
  itemType: string,
  dispatch?: EngineDispatch,
): boolean {
  const engineItemType = requireNodeType(state, itemType, "liftListItem");
  return proseMirrorLiftListItem(engineItemType)(state, dispatch);
}

/** Sinks the list item around the selection into an inner (nested) list. */
export function runEngineSinkListItem(
  state: EngineState,
  itemType: string,
  dispatch?: EngineDispatch,
): boolean {
  const engineItemType = requireNodeType(state, itemType, "sinkListItem");
  return proseMirrorSinkListItem(engineItemType)(state, dispatch);
}
