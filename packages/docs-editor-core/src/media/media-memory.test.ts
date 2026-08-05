import { describe, expect, it, vi } from "vitest";

import { redo, undo } from "../commands";
import { createSchema } from "../schema";
import { EditorState } from "../state";

import { insertMedia, removeMedia } from "./media-commands";
import { mediaNodeSpecs } from "./media-node-specs";
import { MediaUploadRegistry } from "./media-upload-registry";

import type { MediaUploader } from "./media-uploader";

/**
 * Media memory-bound regression tests (ROADMAP Phase 7, Milestone 7.7),
 * following the Phase 6.5 harness.
 *
 * Media is where an editor most easily leaks: every local preview is an object
 * URL whose blob stays alive until it is revoked, and uploads outlive the
 * transaction that started them. None of that is visible to a functional test —
 * an editor that leaks every preview still inserts images correctly — so the
 * properties are pinned here.
 */

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true, marks: "all" },
    ...mediaNodeSpecs(),
  },
});

function createState() {
  return EditorState.create({
    schema,
    doc: schema.createDocument([schema.node("paragraph", undefined, [schema.text("Start")])]),
    selection: { anchor: 1, head: 1 },
    history: true,
  });
}

/** A registry whose object-URL lifecycle is observable rather than real. */
function createTrackedRegistry(uploader: MediaUploader) {
  const created: string[] = [];
  const revoked: string[] = [];
  let counter = 0;

  const registry = new MediaUploadRegistry({
    uploader,
    createPreviewUrl: () => {
      counter += 1;
      const url = `blob:preview-${String(counter)}`;
      created.push(url);
      return url;
    },
    revokePreviewUrl: (url) => {
      revoked.push(url);
    },
    createMediaId: () => `media-${String(counter + 1)}`,
  });

  /** Previews handed out but never released — the leak, stated directly. */
  const outstanding = () => created.filter((url) => !revoked.includes(url));

  return { registry, created, revoked, outstanding };
}

const file = () => new File(["bytes"], "photo.png", { type: "image/png" });

/** Document position of the first top-level node of `type`, or `null`. */
function positionOfFirst(state: ReturnType<typeof createState>, type: string): number | null {
  let position = 0;
  for (const node of state.doc.content) {
    if (node.type === type) {
      return position;
    }
    position += nodeSize(node);
  }
  return null;
}

/**
 * Size of a node in document positions: text is its length, a **leaf occupies
 * exactly one**, and everything else wraps its content in two boundary
 * positions. Media nodes are leaves, so getting that case wrong would misplace
 * every position after the first image.
 */
function nodeSize(node: { type: string; text?: string; content: readonly unknown[] }): number {
  if (typeof node.text === "string") {
    return node.text.length;
  }
  if (schema.spec.nodes[node.type as keyof typeof schema.spec.nodes]?.content === undefined) {
    return 1;
  }
  let inner = 0;
  for (const child of node.content) {
    inner += nodeSize(child as never);
  }
  return inner + 2;
}

const resolvingUploader: MediaUploader = {
  upload: () => Promise.resolve({ src: "https://cdn.test/final.png" }),
};

const failingUploader: MediaUploader = {
  upload: () => Promise.reject(new Error("network")),
};

describe("object-URL lifecycle", () => {
  it("revokes the preview when an upload is released", async () => {
    const { registry, outstanding } = createTrackedRegistry(resolvingUploader);

    const mediaId = registry.start(file());
    await vi.waitFor(() => {
      expect(registry.get(mediaId)?.status).toBe("ready");
    });
    expect(outstanding()).toHaveLength(1);

    registry.release(mediaId);
    expect(outstanding()).toHaveLength(0);
  });

  it("revokes the preview when an upload is cancelled mid-flight", () => {
    const { registry, outstanding } = createTrackedRegistry({
      // Never settles — the upload is still running when it is cancelled.
      upload: () => new Promise(() => undefined),
    });

    const mediaId = registry.start(file());
    expect(outstanding()).toHaveLength(1);

    registry.cancel(mediaId);
    expect(outstanding()).toHaveLength(0);
  });

  it("revokes the preview of a failed upload once released", async () => {
    const { registry, outstanding } = createTrackedRegistry(failingUploader);

    const mediaId = registry.start(file());
    await vi.waitFor(() => {
      expect(registry.get(mediaId)?.status).toBe("failed");
    });

    // A failed upload keeps its preview so the user can retry — the leak would
    // be never revoking it, not holding it while it is still actionable.
    expect(outstanding()).toHaveLength(1);
    registry.release(mediaId);
    expect(outstanding()).toHaveLength(0);
  });

  it("does not accumulate previews across many start/release cycles", async () => {
    const { registry, created, outstanding } = createTrackedRegistry(resolvingUploader);

    for (let cycle = 0; cycle < 50; cycle += 1) {
      const mediaId = registry.start(file());
      await vi.waitFor(() => {
        expect(registry.get(mediaId)?.status).toBe("ready");
      });
      registry.release(mediaId);
    }

    expect(created).toHaveLength(50);
    // Fifty uploads, nothing retained: the count must be zero, not merely small.
    expect(outstanding()).toHaveLength(0);
    expect(registry.all()).toHaveLength(0);
  });

  it("releases everything still outstanding on destroy", () => {
    const { registry, outstanding } = createTrackedRegistry({
      upload: () => new Promise(() => undefined),
    });

    for (let index = 0; index < 5; index += 1) {
      registry.start(file());
    }
    expect(outstanding()).toHaveLength(5);

    // A registry outliving its editor would otherwise keep five blobs and five
    // in-flight requests alive for the page's lifetime.
    registry.destroy();
    expect(outstanding()).toHaveLength(0);
    expect(registry.all()).toHaveLength(0);
  });

  it("retrying a failed upload reuses its preview rather than creating another", async () => {
    let attempt = 0;
    const { registry, created } = createTrackedRegistry({
      upload: () => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(new Error("network"))
          : Promise.resolve({ src: "https://cdn.test/final.png" });
      },
    });

    const mediaId = registry.start(file());
    await vi.waitFor(() => {
      expect(registry.get(mediaId)?.status).toBe("failed");
    });

    registry.retry(mediaId);
    await vi.waitFor(() => {
      expect(registry.get(mediaId)?.status).toBe("ready");
    });

    // One file, one preview — a retry that allocated a second would leak one
    // blob per failure, which is exactly when retries are most likely.
    expect(created).toHaveLength(1);
  });
});

describe("subscription lifecycle", () => {
  it("drops listeners on unsubscribe", async () => {
    const { registry } = createTrackedRegistry(resolvingUploader);
    const listener = vi.fn();

    const unsubscribe = registry.subscribe(listener);
    const first = registry.start(file());
    await vi.waitFor(() => {
      expect(registry.get(first)?.status).toBe("ready");
    });
    const callsWhileSubscribed = listener.mock.calls.length;
    expect(callsWhileSubscribed).toBeGreaterThan(0);

    unsubscribe();
    const second = registry.start(file());
    await vi.waitFor(() => {
      expect(registry.get(second)?.status).toBe("ready");
    });

    expect(listener.mock.calls.length).toBe(callsWhileSubscribed);
  });

  it("clears every listener on destroy", () => {
    const { registry } = createTrackedRegistry(resolvingUploader);
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.destroy();
    listener.mockClear();

    // Nothing left holding a reference to the subscriber.
    registry.start(file());
    expect(listener).not.toHaveBeenCalled();
  });

  it("survives repeated subscribe/unsubscribe cycles without retaining any", () => {
    const { registry } = createTrackedRegistry(resolvingUploader);
    const listener = vi.fn();

    for (let cycle = 0; cycle < 100; cycle += 1) {
      registry.subscribe(listener)();
    }

    registry.start(file());
    // Were unsubscribes leaking, the listener would fire once per retained
    // registration rather than not at all.
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("document memory across media edit cycles", () => {
  it("keeps the undo stack bounded when inserting and removing media", () => {
    let state = EditorState.create({
      schema,
      doc: schema.createDocument([schema.node("paragraph", undefined, [schema.text("Start")])]),
      selection: { anchor: 1, head: 1 },
      history: { depth: 5, newGroupDelay: 0 },
    });

    for (let cycle = 0; cycle < 40; cycle += 1) {
      insertMedia("image", { src: `https://cdn.test/${String(cycle)}.png` })(
        state,
        (transaction) => {
          state = state.apply(transaction);
        },
      );
    }

    let steps = 0;
    for (;;) {
      let next: EditorState | null = null;
      const handled = undo(state, (transaction) => {
        next = state.apply(transaction);
      });
      if (!handled || next === null) {
        break;
      }
      state = next;
      steps += 1;
      if (steps > 200) {
        throw new Error("Undo stack did not terminate — media history is unbounded.");
      }
    }

    // 40 insertions, depth 5 — capped, not proportional to the edit count.
    expect(steps).toBeGreaterThan(0);
    expect(steps).toBeLessThanOrEqual(6);
  });

  it("returns to the original document after insert then undo", () => {
    const initial = createState();
    let state = initial;

    insertMedia("image", { src: "https://cdn.test/a.png" })(state, (transaction) => {
      state = state.apply(transaction);
    });
    expect(JSON.stringify(state.doc)).not.toBe(JSON.stringify(initial.doc));

    undo(state, (transaction) => {
      state = state.apply(transaction);
    });

    // Structural sharing means an undone insert must leave the document
    // *equal* to where it started — a stale retained subtree would show up as
    // a difference here.
    expect(JSON.stringify(state.doc)).toBe(JSON.stringify(initial.doc));
  });

  it("retains no media across repeated insert/remove cycles", () => {
    let state = createState();
    const CYCLES = 30;
    const initialBlocks = state.doc.content.length;

    for (let cycle = 0; cycle < CYCLES; cycle += 1) {
      insertMedia("image", { src: `https://cdn.test/${String(cycle)}.png` })(
        state,
        (transaction) => {
          state = state.apply(transaction);
        },
      );

      // `removeMedia` acts on a *node selection*, which insertion does not
      // leave behind — the caller selects what to remove. Doing that here is
      // what makes this a real round trip rather than an insert that silently
      // never gets undone.
      const imageAt = positionOfFirst(state, "image");
      expect(imageAt).not.toBeNull();
      state = state.apply(state.tr.selectNode(imageAt as number));

      const removed = removeMedia(state, (transaction) => {
        state = state.apply(transaction);
      });
      expect(removed).toBe(true);

      // The media itself must never survive its own removal.
      expect(state.doc.content.some((node) => node.type === "image")).toBe(false);
    }

    // Each cycle does leave one extra empty paragraph behind: inserting a block
    // at a cursor inside text splits that paragraph, and removing the block
    // leaves both halves. That is generic block-insert behaviour rather than
    // anything media-specific, and it is bounded at one block per cycle — so
    // the assertion is that bound, not a false claim of zero growth. Anything
    // worse than linear (a node retained per cycle, a subtree copied) fails.
    expect(state.doc.content.length).toBeLessThanOrEqual(initialBlocks + CYCLES);
  });

  it("does not grow the document across insert/undo/redo cycles", () => {
    let state = createState();
    const blocksWithoutMedia = state.doc.content.length;

    for (let cycle = 0; cycle < 30; cycle += 1) {
      insertMedia("image", { src: `https://cdn.test/${String(cycle)}.png` })(
        state,
        (transaction) => {
          state = state.apply(transaction);
        },
      );
      const blocksWithMedia = state.doc.content.length;

      undo(state, (transaction) => {
        state = state.apply(transaction);
      });
      expect(state.doc.content.length).toBe(blocksWithoutMedia);

      redo(state, (transaction) => {
        state = state.apply(transaction);
      });
      expect(state.doc.content.length).toBe(blocksWithMedia);

      // Leave the loop where it started, so 30 cycles cannot accumulate.
      undo(state, (transaction) => {
        state = state.apply(transaction);
      });
    }

    expect(state.doc.content.length).toBe(blocksWithoutMedia);
  });
});
