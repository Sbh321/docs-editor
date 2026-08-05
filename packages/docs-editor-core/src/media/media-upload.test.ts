import { describe, expect, it, vi } from "vitest";

import { createSchema } from "../schema";
import { EditorState } from "../state";

import { insertMedia } from "./media-commands";
import { mediaNodeSpecs } from "./media-node-specs";
import { applyMediaUploadResult, hasMediaUpload } from "./media-upload-commands";
import { MediaUploadRegistry } from "./media-upload-registry";

import type { MediaUploader, MediaUploadResult } from "./media-uploader";
import type { Dispatch } from "../commands";

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true, marks: "all" },
    ...mediaNodeSpecs(),
  },
});

/** A stand-in for a browser `File`; only `name`/`size` are read here. */
function fakeFile(name = "photo.png"): File {
  return { name, size: 1024, type: "image/png" } as unknown as File;
}

/** Registry wired with injected preview handling so it runs outside a browser. */
function createRegistry(uploader: MediaUploader) {
  const revoked: string[] = [];
  let idCounter = 0;
  const registry = new MediaUploadRegistry({
    uploader,
    createPreviewUrl: (file) => `preview:${file.name}`,
    revokePreviewUrl: (url) => revoked.push(url),
    createMediaId: () => {
      idCounter += 1;
      return `media-${String(idCounter)}`;
    },
  });
  return { registry, revoked };
}

/** An uploader resolved manually, so tests control when it finishes. */
function deferredUploader() {
  let resolve!: (result: MediaUploadResult) => void;
  let reject!: (error: Error) => void;
  let reportProgress: ((loaded: number, total: number) => void) | null = null;
  let lastSignal: AbortSignal | null = null;

  const uploader: MediaUploader = {
    upload({ signal, onProgress }) {
      reportProgress = onProgress;
      lastSignal = signal;
      return new Promise<MediaUploadResult>((res, rej) => {
        resolve = res;
        reject = rej;
      });
    },
  };

  return {
    uploader,
    resolve: (result: MediaUploadResult) => resolve(result),
    reject: (error: Error) => reject(error),
    progress: (loaded: number, total: number) => reportProgress?.(loaded, total),
    signal: () => lastSignal,
  };
}

function stateWithParagraph(text = "Start") {
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text(text)])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 }, history: true });
}

function run<N extends string, M extends string>(
  state: EditorState<N, M>,
  command: (state: EditorState<N, M>, dispatch?: Dispatch<N>) => boolean,
): EditorState<N, M> | null {
  let next: EditorState<N, M> | null = null;
  const handled = command(state, (transaction) => {
    next = state.apply(transaction);
  });
  return handled ? next : null;
}

describe("MediaUploadRegistry", () => {
  it("reports progress and resolves to ready", async () => {
    const deferred = deferredUploader();
    const { registry } = createRegistry(deferred.uploader);

    const mediaId = registry.start(fakeFile());
    expect(registry.get(mediaId)?.previewUrl).toBe("preview:photo.png");

    // Let the upload start before driving it.
    await Promise.resolve();
    expect(registry.get(mediaId)?.status).toBe("uploading");

    deferred.progress(512, 1024);
    expect(registry.get(mediaId)?.progress).toBe(0.5);

    deferred.resolve({ src: "https://cdn.test/photo.png", width: 800, height: 600 });
    await Promise.resolve();
    await Promise.resolve();

    const upload = registry.get(mediaId);
    expect(upload?.status).toBe("ready");
    expect(upload?.progress).toBe(1);
    expect(upload?.result?.src).toBe("https://cdn.test/photo.png");
  });

  it("tolerates an unknown total instead of dividing by zero", async () => {
    const deferred = deferredUploader();
    const { registry } = createRegistry(deferred.uploader);
    const mediaId = registry.start(fakeFile());
    await Promise.resolve();

    deferred.progress(100, 0);
    expect(registry.get(mediaId)?.progress).toBe(0);
  });

  it("records a failure and can retry it", async () => {
    const attempts: number[] = [];
    let fail = true;
    const uploader: MediaUploader = {
      upload() {
        attempts.push(1);
        return fail
          ? Promise.reject(new Error("network down"))
          : Promise.resolve({ src: "https://cdn.test/ok.png" });
      },
    };
    const { registry } = createRegistry(uploader);

    const mediaId = registry.start(fakeFile());
    await Promise.resolve();
    await Promise.resolve();
    expect(registry.get(mediaId)?.status).toBe("failed");
    expect(registry.get(mediaId)?.error?.message).toBe("network down");

    fail = false;
    expect(registry.retry(mediaId)).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.get(mediaId)?.status).toBe("ready");
    expect(attempts).toHaveLength(2);
  });

  it("does not retry an upload that is not failed", async () => {
    const deferred = deferredUploader();
    const { registry } = createRegistry(deferred.uploader);
    const mediaId = registry.start(fakeFile());
    await Promise.resolve();

    expect(registry.retry(mediaId)).toBe(false);
  });

  it("aborts and releases the preview on cancel", async () => {
    const deferred = deferredUploader();
    const { registry, revoked } = createRegistry(deferred.uploader);

    const mediaId = registry.start(fakeFile());
    await Promise.resolve();

    registry.cancel(mediaId);

    expect(deferred.signal()?.aborted).toBe(true);
    expect(registry.get(mediaId)).toBeUndefined();
    expect(revoked).toEqual(["preview:photo.png"]);
  });

  it("ignores a result that arrives after cancellation", async () => {
    const deferred = deferredUploader();
    const { registry } = createRegistry(deferred.uploader);

    const mediaId = registry.start(fakeFile());
    await Promise.resolve();
    registry.cancel(mediaId);

    // A slow upload resolving after the user cancelled must not resurrect it.
    deferred.resolve({ src: "https://cdn.test/late.png" });
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.get(mediaId)).toBeUndefined();
  });

  it("revokes previews on release and destroy", async () => {
    const deferred = deferredUploader();
    const { registry, revoked } = createRegistry(deferred.uploader);

    const first = registry.start(fakeFile("a.png"));
    registry.start(fakeFile("b.png"));
    await Promise.resolve();

    registry.release(first);
    expect(revoked).toEqual(["preview:a.png"]);

    // Teardown must not leave the remaining blob pinned for the page's life.
    registry.destroy();
    expect(revoked).toEqual(["preview:a.png", "preview:b.png"]);
    expect(registry.all()).toHaveLength(0);
  });

  it("notifies subscribers and stops after unsubscribe", async () => {
    const deferred = deferredUploader();
    const { registry } = createRegistry(deferred.uploader);
    const listener = vi.fn();

    const unsubscribe = registry.subscribe(listener);
    registry.start(fakeFile());
    await Promise.resolve();
    expect(listener).toHaveBeenCalled();

    const callsBefore = listener.mock.calls.length;
    unsubscribe();
    deferred.progress(256, 1024);
    expect(listener.mock.calls.length).toBe(callsBefore);
  });
});

describe("applyMediaUploadResult", () => {
  it("writes the result onto the node carrying the id", () => {
    const state = stateWithParagraph();
    const inserted = run(state, insertMedia("image", { mediaId: "media-1" }));

    const completed = run(
      inserted!,
      applyMediaUploadResult("media-1", {
        src: "https://cdn.test/x.png",
        width: 640,
        height: 480,
      }),
    );

    const image = completed?.doc.content.find((node) => node.type === "image");
    expect(image?.attrs.src).toBe("https://cdn.test/x.png");
    expect(image?.attrs.width).toBe(640);
    expect(image?.attrs.height).toBe(480);
  });

  it("finds the node after the document has changed underneath it", () => {
    // The whole point of correlating by id: an upload that started before the
    // user typed above the image must still land on the image, not on whatever
    // now occupies the position it had at the time.
    let state: EditorState = stateWithParagraph();
    state = run(state, insertMedia("image", { mediaId: "media-1" }))!;

    const posBefore = state.doc.content.findIndex((node) => node.type === "image");
    // Insert a paragraph at the very start, shifting everything after it.
    state = state.apply(state.tr.insertText("Typed while uploading ", 1, 1));

    const completed = run(
      state,
      applyMediaUploadResult("media-1", { src: "https://cdn.test/moved.png" }),
    );

    const image = completed?.doc.content.find((node) => node.type === "image");
    expect(image?.attrs.src).toBe("https://cdn.test/moved.png");
    expect(posBefore).toBeGreaterThanOrEqual(0);
  });

  it("declines when the node has been deleted mid-upload", () => {
    const state = stateWithParagraph();
    // Nothing carries this id, which is what a deleted or undone node looks like.
    expect(applyMediaUploadResult("gone", { src: "https://cdn.test/x.png" })(state)).toBe(false);
  });

  it("does not overwrite a size the user set while uploading", () => {
    let state: EditorState = stateWithParagraph();
    state = run(state, insertMedia("image", { mediaId: "media-1", width: 200 }))!;

    const completed = run(
      state,
      applyMediaUploadResult("media-1", { src: "https://cdn.test/x.png", width: 1600 }),
    );

    const image = completed?.doc.content.find((node) => node.type === "image");
    // The explicit resize wins; only the unset height takes the backend value.
    expect(image?.attrs.width).toBe(200);
  });

  it("fills file attachment metadata when the node has those attributes", () => {
    let state: EditorState = stateWithParagraph();
    state = run(state, insertMedia("file", { mediaId: "media-2" }))!;

    const completed = run(
      state,
      applyMediaUploadResult("media-2", {
        src: "https://cdn.test/doc.pdf",
        filename: "report.pdf",
        mimeType: "application/pdf",
      }),
    );

    const file = completed?.doc.content.find((node) => node.type === "file");
    expect(file?.attrs.filename).toBe("report.pdf");
    expect(file?.attrs.mimeType).toBe("application/pdf");
  });

  it("hasMediaUpload reports whether the node still exists", () => {
    let state: EditorState = stateWithParagraph();
    state = run(state, insertMedia("image", { mediaId: "media-1" }))!;

    expect(hasMediaUpload(state, "media-1")).toBe(true);
    expect(hasMediaUpload(state, "media-9")).toBe(false);
  });
});
