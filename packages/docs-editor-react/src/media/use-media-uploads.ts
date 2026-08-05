import { applyMediaUploadResult } from "@sbh321/docs-editor-core";
import { useEffect, useState } from "react";

import { useEditorDispatch } from "../use-editor-dispatch";
import { useEditorState } from "../use-editor-state";

import type { MediaUpload, MediaUploadRegistry } from "@sbh321/docs-editor-core";

/**
 * Connects a {@link MediaUploadRegistry} to the document.
 *
 * The registry never touches the document and the document never holds upload
 * state — that separation is what keeps placeholders out of undo history. But
 * *something* has to join them when an upload finishes, and leaving that to
 * each application turned out to be a reliable way to ship a broken editor:
 * the node stays at the empty `src` it was inserted with and renders as a
 * broken image forever, while the upload reports success. That bug was written
 * twice in this repository before this hook existed.
 *
 * ```tsx
 * const [registry] = useState(() => new MediaUploadRegistry({ uploader }));
 * const uploads = useMediaUploads(registry);
 *
 * const onFile = (file: File) => {
 *   const mediaId = registry.start(file);
 *   insertMedia("image", { mediaId, alt: file.name })(state, dispatch);
 * };
 * ```
 *
 * Returns the uploads currently in flight, for rendering progress and retry.
 */
export function useMediaUploads(registry: MediaUploadRegistry): readonly MediaUpload[] {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [uploads, setUploads] = useState<readonly MediaUpload[]>(() => registry.all());

  useEffect(() => registry.subscribe(setUploads), [registry]);

  useEffect(() => {
    for (const upload of uploads) {
      if (upload.status !== "ready" || !upload.result) {
        continue;
      }
      // Found by `mediaId`, not by a remembered position, so this lands on the
      // right node even if the user typed above it while the upload ran.
      applyMediaUploadResult(upload.mediaId, upload.result)(state, dispatch);
      // Released only after the result is in the document — releasing revokes
      // the preview URL.
      registry.release(upload.mediaId);
    }
    // Reads the *current* state and dispatch: a callback registered once inside
    // `subscribe` would close over the state as it was at mount.
  }, [uploads, state, dispatch, registry]);

  // A registry outliving its editor keeps both its blobs and its in-flight
  // requests alive; Milestone 7.7 pins that as a leak.
  useEffect(
    () => () => {
      registry.destroy();
    },
    [registry],
  );

  return uploads;
}
