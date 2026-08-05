import type { MediaUploader } from "@sbh321/docs-editor-core";

/**
 * A stand-in for a real upload service.
 *
 * Uploading is the **application's** job — it means credentials, storage, CORS
 * and scanning, none of which belong in an editor (CLAUDE.md scope discipline).
 * The editor defines the contract and drives the lifecycle; this is what a real
 * application would replace with a call to its own backend.
 *
 * Files whose name contains "fail" reject, so the failure and retry paths are
 * reachable by hand and from a test — the part a demo usually skips.
 */
export const mockUploader: MediaUploader = {
  upload: ({ file, signal, onProgress }) =>
    new Promise((resolve, reject) => {
      let sent = 0;
      const total = Math.max(1, file.size);
      const timer = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(timer);
          reject(new Error("Upload cancelled"));
          return;
        }
        sent = Math.min(total, sent + Math.ceil(total / 4));
        onProgress?.(sent, total);
        if (sent >= total) {
          clearInterval(timer);
          if (file.name.includes("fail")) {
            reject(new Error("Upload failed (simulated)"));
          } else {
            resolve({ src: URL.createObjectURL(file) });
          }
        }
      }, 60);
    }),
};
