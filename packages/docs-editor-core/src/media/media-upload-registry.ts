/**
 * In-flight upload state (ROADMAP Phase 7 — Media, Milestone 7.3).
 *
 * Upload progress lives **here, not in the document**. Putting placeholders and
 * progress into the model would push them through undo history, let a document
 * be serialized mid-upload, and make every transaction a re-render trigger for
 * a progress bar. Documents carry only the durable `mediaId` and final `src`;
 * everything transient is here, exactly as zoom and page layout sit outside the
 * model (see ARCHITECTURE's Media Architecture).
 *
 * Framework-agnostic: it exposes a subscription rather than depending on any UI
 * library, so a React adapter can bind to it without the core knowing React
 * exists.
 */

import type { MediaUpload, MediaUploader, MediaUploadResult } from "./media-uploader";

export interface MediaUploadRegistryOptions {
  /** The application's upload implementation. */
  readonly uploader: MediaUploader;
  /**
   * Builds a local preview URL for a file, or returns `null` when previews are
   * not possible. Defaults to `URL.createObjectURL` where available — injectable
   * so the registry stays testable outside a browser.
   */
  readonly createPreviewUrl?: (file: File) => string | null;
  /** Releases a preview URL. Defaults to `URL.revokeObjectURL`. */
  readonly revokePreviewUrl?: (url: string) => void;
  /** Generates a media id. Defaults to a UUID where available. */
  readonly createMediaId?: () => string;
}

/** Notified whenever any upload's state changes. */
export type MediaUploadListener = (uploads: readonly MediaUpload[]) => void;

function defaultCreatePreviewUrl(file: File): string | null {
  // Absent in non-browser environments; previews are an enhancement, not a
  // requirement, so fall back to none rather than throwing.
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  return URL.createObjectURL(file);
}

function defaultRevokePreviewUrl(url: string): void {
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

let fallbackIdCounter = 0;

function defaultCreateMediaId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackIdCounter += 1;
  return `media-${String(Date.now())}-${String(fallbackIdCounter)}`;
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Tracks uploads from start to completion, and is the only thing that knows an
 * upload is in flight.
 */
export class MediaUploadRegistry {
  private readonly uploader: MediaUploader;
  private readonly createPreviewUrl: (file: File) => string | null;
  private readonly revokePreviewUrl: (url: string) => void;
  private readonly createMediaId: () => string;

  private readonly uploads = new Map<string, MediaUpload>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly listeners = new Set<MediaUploadListener>();

  constructor(options: MediaUploadRegistryOptions) {
    this.uploader = options.uploader;
    this.createPreviewUrl = options.createPreviewUrl ?? defaultCreatePreviewUrl;
    this.revokePreviewUrl = options.revokePreviewUrl ?? defaultRevokePreviewUrl;
    this.createMediaId = options.createMediaId ?? defaultCreateMediaId;
  }

  /**
   * Begins uploading `file` and returns the `mediaId` to store on the node.
   *
   * Returns immediately — the upload runs in the background, and progress is
   * observed through {@link MediaUploadRegistry.subscribe}.
   */
  start(file: File, options: { readonly mediaId?: string } = {}): string {
    const mediaId = options.mediaId ?? this.createMediaId();
    this.uploads.set(mediaId, {
      mediaId,
      status: "pending",
      progress: 0,
      previewUrl: this.createPreviewUrl(file),
      error: null,
      result: null,
      file,
    });
    this.emit();
    void this.run(mediaId);
    return mediaId;
  }

  /** Retries a failed upload, reusing the file it was started with. */
  retry(mediaId: string): boolean {
    const upload = this.uploads.get(mediaId);
    if (!upload || upload.status !== "failed") {
      return false;
    }
    this.patch(mediaId, { status: "pending", progress: 0, error: null });
    void this.run(mediaId);
    return true;
  }

  /**
   * Cancels an in-flight upload and forgets it, releasing its preview.
   *
   * The node it belonged to is the caller's to remove — the registry never
   * touches the document.
   */
  cancel(mediaId: string): boolean {
    const controller = this.controllers.get(mediaId);
    controller?.abort();
    this.controllers.delete(mediaId);
    return this.release(mediaId);
  }

  /**
   * Forgets an upload and revokes its preview URL.
   *
   * Call this once the result has been written into the document. An
   * unreleased preview keeps its blob alive for the page's lifetime, which is
   * precisely the leak the memory tests guard against.
   */
  release(mediaId: string): boolean {
    const upload = this.uploads.get(mediaId);
    if (!upload) {
      return false;
    }
    if (upload.previewUrl) {
      this.revokePreviewUrl(upload.previewUrl);
    }
    this.uploads.delete(mediaId);
    this.controllers.delete(mediaId);
    this.emit();
    return true;
  }

  /** The current state of one upload, or `undefined` once released. */
  get(mediaId: string): MediaUpload | undefined {
    return this.uploads.get(mediaId);
  }

  /** Every tracked upload. */
  all(): readonly MediaUpload[] {
    return [...this.uploads.values()];
  }

  /** Subscribes to state changes. Returns an unsubscribe function. */
  subscribe(listener: MediaUploadListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Aborts everything and releases every preview. Call on teardown — a
   * registry that outlives its editor would otherwise keep both its blobs and
   * its in-flight requests alive.
   */
  destroy(): void {
    for (const controller of this.controllers.values()) {
      controller.abort();
    }
    this.controllers.clear();
    for (const upload of this.uploads.values()) {
      if (upload.previewUrl) {
        this.revokePreviewUrl(upload.previewUrl);
      }
    }
    this.uploads.clear();
    this.listeners.clear();
  }

  private async run(mediaId: string): Promise<void> {
    const upload = this.uploads.get(mediaId);
    if (!upload) {
      return;
    }

    const controller = new AbortController();
    this.controllers.set(mediaId, controller);
    this.patch(mediaId, { status: "uploading", progress: 0 });

    try {
      const result = await this.uploader.upload({
        file: upload.file,
        mediaId,
        signal: controller.signal,
        onProgress: (loaded, total) => {
          // A cancelled upload may keep reporting briefly; ignore it so a stale
          // callback can't resurrect an entry the caller already dropped.
          if (controller.signal.aborted || !this.uploads.has(mediaId)) {
            return;
          }
          this.patch(mediaId, { progress: total > 0 ? Math.min(1, loaded / total) : 0 });
        },
      });

      if (controller.signal.aborted || !this.uploads.has(mediaId)) {
        return;
      }
      this.patch(mediaId, { status: "ready", progress: 1, result, error: null });
    } catch (cause) {
      if (controller.signal.aborted || !this.uploads.has(mediaId)) {
        return;
      }
      this.patch(mediaId, { status: "failed", error: toError(cause) });
    } finally {
      this.controllers.delete(mediaId);
    }
  }

  private patch(
    mediaId: string,
    changes: Partial<Omit<MediaUpload, "mediaId" | "file" | "previewUrl">> & {
      readonly result?: MediaUploadResult | null;
    },
  ): void {
    const current = this.uploads.get(mediaId);
    if (!current) {
      return;
    }
    this.uploads.set(mediaId, { ...current, ...changes });
    this.emit();
  }

  private emit(): void {
    const snapshot = this.all();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
