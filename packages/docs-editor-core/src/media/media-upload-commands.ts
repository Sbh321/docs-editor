/**
 * Commands connecting a finished upload back to the document
 * (ROADMAP Phase 7 — Media, Milestone 7.3).
 *
 * The registry never touches the document and the document never holds upload
 * state; this is the seam between them, and it is deliberately a `Command` like
 * any other so completion goes through the same dispatch, history and
 * validation path as a keystroke.
 */

import { engineFindNodeByAttr } from "../engine";

import { MEDIA_ATTRS } from "./media-types";

import type { MediaUploadResult } from "./media-uploader";
import type { Dispatch } from "../commands";
import type { EditorState } from "../state";

/**
 * Writes a finished upload's result onto the node carrying `mediaId`.
 *
 * Finds the node **by id, not by a remembered position**: an upload started
 * before the user typed a paragraph above it would otherwise write its `src`
 * into whatever now occupies the old position. Reports `false` when no such
 * node remains — the user may have deleted or undone it while the upload was in
 * flight, which is ordinary, not an error.
 */
export function applyMediaUploadResult(mediaId: string, result: MediaUploadResult) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const found = engineFindNodeByAttr<NodeName>(state.engine, MEDIA_ATTRS.mediaId, mediaId);
    if (!found) {
      return false;
    }
    const { node, pos } = found;

    const attrs: Record<string, unknown> = {
      ...node.attrs,
      [MEDIA_ATTRS.src]: result.src,
    };
    // Only fill dimensions the node does not already have, so an explicit
    // resize the user performed while the upload was in flight is not undone by
    // its completion.
    if (result.width !== undefined && node.attrs[MEDIA_ATTRS.width] === null) {
      attrs[MEDIA_ATTRS.width] = result.width;
    }
    if (result.height !== undefined && node.attrs[MEDIA_ATTRS.height] === null) {
      attrs[MEDIA_ATTRS.height] = result.height;
    }
    if (result.filename !== undefined && "filename" in node.attrs) {
      attrs.filename = result.filename;
    }
    if (result.mimeType !== undefined && "mimeType" in node.attrs) {
      attrs.mimeType = result.mimeType;
    }

    const validated = state.schema.blockType(node.type, attrs);
    dispatch?.(state.tr.setNodeAttrs(pos, validated.attrs));
    return true;
  };
}

/**
 * Whether a node carrying `mediaId` is still in the document — so a caller can
 * skip work, or clean up a registry entry whose node has gone.
 */
export function hasMediaUpload<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  mediaId: string,
): boolean {
  return engineFindNodeByAttr(state.engine, MEDIA_ATTRS.mediaId, mediaId) !== null;
}
