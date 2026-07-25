import {
  activeBlockType,
  activeMarks,
  isBlockActive,
  isMarkActive,
} from "@sbh321/docs-editor-core";

import { useEditorState } from "./use-editor-state";

import type { ActiveBlock, Mark } from "@sbh321/docs-editor-core";

/**
 * The marks active for the current selection — what a toolbar renders as
 * "pressed" (see the core `activeMarks` for the exact semantics at a cursor
 * versus a range). Recomputed whenever the editor state changes.
 */
export function useActiveMarks<
  NodeName extends string = string,
  MarkName extends string = string,
>(): readonly Mark<MarkName>[] {
  return activeMarks(useEditorState<NodeName, MarkName>());
}

/**
 * Whether a mark of type `markType` is active for the current selection. Pass
 * `attrs` to require matching attributes (e.g. a link with a given `href`).
 * The idiomatic way to drive a formatting button's pressed state.
 */
export function useIsMarkActive<NodeName extends string = string, MarkName extends string = string>(
  markType: MarkName,
  attrs?: Readonly<Record<string, unknown>>,
): boolean {
  return isMarkActive(useEditorState<NodeName, MarkName>(), markType, attrs);
}

/** The type and attributes of the textblock the selection currently sits in. */
export function useActiveBlockType<
  NodeName extends string = string,
  MarkName extends string = string,
>(): ActiveBlock<NodeName> {
  return activeBlockType(useEditorState<NodeName, MarkName>());
}

/**
 * Whether the active block is of type `nodeType`. Pass `attrs` to require
 * matching attributes (e.g. `useIsBlockActive("heading", { level: 2 })`) — the
 * idiomatic way to drive a block-style button's pressed state.
 */
export function useIsBlockActive<
  NodeName extends string = string,
  MarkName extends string = string,
>(nodeType: NodeName, attrs?: Readonly<Record<string, unknown>>): boolean {
  return isBlockActive(useEditorState<NodeName, MarkName>(), nodeType, attrs);
}
