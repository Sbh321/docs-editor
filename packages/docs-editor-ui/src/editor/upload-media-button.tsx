import { insertMedia } from "@sbh321/docs-editor-core";
import { UploadIcon } from "@sbh321/docs-editor-icons";
import { useEditor } from "@sbh321/docs-editor-react";

import { Tooltip } from "../primitives/tooltip";

import type { MediaUploadRegistry } from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

export interface UploadMediaButtonProps {
  /**
   * The registry that owns the upload lifecycle. The editor starts the upload
   * and inserts a pending node; the registry's uploader — supplied by the
   * application, since credentials, storage and CORS are its business — moves
   * the bytes.
   */
  readonly uploads: MediaUploadRegistry;
  /** File types offered by the picker. Defaults to images. */
  readonly accept?: string;
  /** Accessible name. Defaults to `"Upload media"`. */
  readonly label?: string;
}

/**
 * A toolbar control that picks files and inserts them as uploading media
 * (ROADMAP Phase 9, Milestone 9.10).
 *
 * This lived in the playground as a raw native file input — which meant every
 * consumer of `<DocsEditor />` had to rebuild file-picking to get uploads at
 * all, and the playground showed a browser-styled "Choose File" control in an
 * otherwise themed toolbar.
 *
 * It is a **`<label>`**, not a `<button>`: clicking a label opens its input's
 * file picker natively, where a button would need a ref reach-around to do the
 * same. The input itself is visually hidden but kept in the tab order —
 * `display: none` would make uploading mouse-only.
 */
export function UploadMediaButton({
  uploads,
  accept = "image/*",
  label = "Upload media",
}: UploadMediaButtonProps): ReactNode {
  const { state, dispatch } = useEditor();

  return (
    <Tooltip label={label}>
      <label className="de-upload-button">
        <UploadIcon />
        <input
          type="file"
          aria-label={label}
          accept={accept}
          multiple
          onChange={(event) => {
            for (const file of event.target.files ?? []) {
              // `mediaId` is what correlates the registry's upload with the
              // node it will eventually fill in — see `useMediaUploads`.
              const mediaId = uploads.start(file);
              insertMedia("image", { mediaId, alt: file.name })(state, dispatch);
            }
            // Reset, so picking the same file again fires another change event.
            event.target.value = "";
          }}
        />
      </label>
    </Tooltip>
  );
}
