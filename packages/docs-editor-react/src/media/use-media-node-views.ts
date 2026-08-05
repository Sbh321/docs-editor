import { useEffect, useRef, useState } from "react";

import { useEditorDispatch } from "../use-editor-dispatch";
import { useEditorState } from "../use-editor-state";

import { createMediaNodeViews } from "./media-node-views";

import type { MediaNodeViewOptions } from "./media-node-views";
import type { NodeViewMap } from "@sbh321/docs-editor-core";

/**
 * Media node views bound to the editor, ready to pass to `<Editor nodeViews>`.
 *
 * The returned map is **stable for the component's lifetime**, which matters:
 * `<Editor>` reads `nodeViews` once at mount, so a map rebuilt each render would
 * either be ignored or force a remount. `options` is read once for the same
 * reason, matching the `nodeRenderers` contract.
 *
 * A node view outlives the render that created it, so it cannot close over
 * `state` — by the time a drag ends, that value is stale. It reads from a ref
 * refreshed after every render instead, so dispatching always builds its
 * transaction from the current state.
 */
export function useMediaNodeViews(options: Omit<MediaNodeViewOptions, "bridge"> = {}): NodeViewMap {
  const state = useEditorState();
  const dispatch = useEditorDispatch();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // The standard "latest ref" pattern. `react-hooks/refs` flags the closure
  // below because it is *created* during render, but it is only ever *called*
  // later — from a pointer handler, long after commit — which is exactly the
  // case the rule cannot distinguish. Reading `state` eagerly instead would
  // capture the value at mount and make every resize write against a stale
  // document.
  // eslint-disable-next-line react-hooks/refs -- deferred read; see above.
  const [nodeViews] = useState<NodeViewMap>(() =>
    createMediaNodeViews({
      ...options,
      bridge: {
        getState: () => stateRef.current,
        dispatch,
      },
    }),
  );

  return nodeViews;
}
