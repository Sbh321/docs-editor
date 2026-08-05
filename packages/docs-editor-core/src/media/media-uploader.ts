/**
 * The upload contract (ROADMAP Phase 7 — Media, Milestone 7.3).
 *
 * The editor drives uploads but never performs one. Moving bytes means
 * endpoints, credentials, retries against a specific backend and storage
 * policy — all application concerns per CLAUDE.md, none of which belong in a
 * reusable editing engine. So the application implements {@link MediaUploader}
 * and the core orchestrates it: tracking progress, honouring cancellation, and
 * writing the result into the document.
 */

/** What the editor hands an uploader for one file. */
export interface MediaUploadRequest {
  /** The file to upload. */
  readonly file: File;
  /** The id correlating this upload with its node in the document. */
  readonly mediaId: string;
  /**
   * Aborted when the upload is cancelled. Implementations should pass it to
   * `fetch` (or check it around long steps) so a cancelled upload stops
   * consuming bandwidth rather than merely having its result discarded.
   */
  readonly signal: AbortSignal;
  /**
   * Reports progress. `total` may be `0` when the length is unknown, so guard
   * before dividing.
   */
  readonly onProgress: (loaded: number, total: number) => void;
}

/** What an uploader resolves with once the bytes are stored. */
export interface MediaUploadResult {
  /** Final URL the media is served from. */
  readonly src: string;
  /** Intrinsic width in pixels, when the backend knows it. */
  readonly width?: number;
  /** Intrinsic height in pixels, when the backend knows it. */
  readonly height?: number;
  /** Resolved MIME type, when it differs from the file's own. */
  readonly mimeType?: string;
  /** Suggested filename, used by file attachments. */
  readonly filename?: string;
}

/**
 * Implemented by the application.
 *
 * ```ts
 * const uploader: MediaUploader = {
 *   async upload({ file, signal, onProgress }) {
 *     const body = new FormData();
 *     body.append("file", file);
 *     const response = await fetch("/api/uploads", { method: "POST", body, signal });
 *     if (!response.ok) {
 *       throw new Error(`Upload failed: ${response.status}`);
 *     }
 *     onProgress(file.size, file.size);
 *     return (await response.json()) as MediaUploadResult;
 *   },
 * };
 * ```
 *
 * Throw to fail the upload; the registry records the error and offers a retry.
 */
export interface MediaUploader {
  upload(request: MediaUploadRequest): Promise<MediaUploadResult>;
}

/** Lifecycle state of one upload. */
export type MediaUploadStatus = "pending" | "uploading" | "ready" | "failed";

/** A snapshot of one upload, as observed by UI. */
export interface MediaUpload {
  readonly mediaId: string;
  readonly status: MediaUploadStatus;
  /** Completion in the range 0–1. `0` while pending, `1` once ready. */
  readonly progress: number;
  /**
   * Local preview URL shown before the upload resolves, or `null` when previews
   * are unavailable. Valid until the upload is released — see
   * `MediaUploadRegistry.release`.
   */
  readonly previewUrl: string | null;
  /** Why the upload failed, when `status` is `"failed"`. */
  readonly error: Error | null;
  /** The uploader's result, when `status` is `"ready"`. */
  readonly result: MediaUploadResult | null;
  /** The file being uploaded, kept so a failed upload can be retried. */
  readonly file: File;
}
