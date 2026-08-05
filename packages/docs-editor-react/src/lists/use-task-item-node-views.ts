import { useEffect, useRef, useState } from "react";

import { useEditorDispatch } from "../use-editor-dispatch";
import { useEditorState } from "../use-editor-state";

import { createTaskItemNodeViews } from "./task-item-node-view";

import type { TaskItemNodeViewOptions } from "./task-item-node-view";
import type { NodeViewMap } from "@sbh321/docs-editor-core";

/**
 * Task-item node views bound to the editor, ready for `<Editor nodeViews>`.
 *
 * Follows `useMediaNodeViews` exactly, for the same reasons: the map is stable
 * for the component's lifetime because `<Editor>` reads `nodeViews` once at
 * mount, and the view reads state through a ref because it outlives the render
 * that created it — a checkbox clicked ten edits later must build its
 * transaction from the current document, not the one at mount.
 *
 * Merge it with other maps when a document has both:
 *
 * ```tsx
 * const nodeViews = { ...useMediaNodeViews(), ...useTaskItemNodeViews() };
 * ```
 */
export function useTaskItemNodeViews(options: TaskItemNodeViewOptions = {}): NodeViewMap {
  const state = useEditorState();
  const dispatch = useEditorDispatch();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // The standard "latest ref" pattern. `react-hooks/refs` flags the closure
  // below because it is *created* during render, but it is only ever *called*
  // later — from a click handler, long after commit.
  // eslint-disable-next-line react-hooks/refs -- deferred read; see above.
  const [nodeViews] = useState<NodeViewMap>(() =>
    createTaskItemNodeViews(() => stateRef.current, dispatch, options),
  );

  return nodeViews;
}
