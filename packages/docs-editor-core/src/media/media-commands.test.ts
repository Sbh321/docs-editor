import { describe, expect, it } from "vitest";

import { createSchema } from "../schema";
import { EditorState } from "../state";

import {
  insertMedia,
  removeMedia,
  setMediaAlignment,
  setMediaAlt,
  setMediaAttrs,
  setMediaSize,
} from "./media-commands";
import { mediaNodeSpecs } from "./media-node-specs";

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

/** A document whose first block is `first`, followed by a paragraph. */
function stateWith(first: ReturnType<typeof schema.node>, selectNodeAt?: number) {
  const doc = schema.createDocument([
    first,
    schema.node("paragraph", undefined, [schema.text("After")]),
  ]);
  const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
  if (selectNodeAt === undefined) {
    return state;
  }
  return state.apply(state.tr.selectNode(selectNodeAt));
}

/** Generic over the schema's node names so results stay narrowly typed. */
type TestCommand<N extends string, M extends string> = (
  state: EditorState<N, M>,
  dispatch?: Dispatch<N>,
) => boolean;

/** Runs a command and returns the resulting state, or `null` if it declined. */
function run<N extends string, M extends string>(
  state: EditorState<N, M>,
  command: TestCommand<N, M>,
): EditorState<N, M> | null {
  let next: EditorState<N, M> | null = null;
  const handled = command(state, (transaction) => {
    next = state.apply(transaction);
  });
  return handled ? next : null;
}

/** `run` for a command expected to apply — fails loudly rather than returning null. */
function runOrThrow<N extends string, M extends string>(
  state: EditorState<N, M>,
  command: TestCommand<N, M>,
): EditorState<N, M> {
  const next = run(state, command);
  if (!next) {
    throw new Error("Expected the command to apply, but it declined.");
  }
  return next;
}

describe("insertMedia", () => {
  it("inserts a bare media node", () => {
    const state = stateWith(schema.node("paragraph", undefined, [schema.text("Doc")]));
    const next = run(state, insertMedia("image", { src: "https://a.test/x.png", alt: "X" }));

    const image = next?.doc.content.find((node) => node.type === "image");
    expect(image?.attrs.src).toBe("https://a.test/x.png");
    expect(image?.attrs.alt).toBe("X");
  });

  it("wraps in a figure with a caption when asked", () => {
    const state = stateWith(schema.node("paragraph", undefined, [schema.text("Doc")]));
    const next = run(
      state,
      insertMedia("image", { src: "https://a.test/x.png" }, { caption: "A caption" }),
    );

    const figure = next?.doc.content.find((node) => node.type === "figure");
    expect(figure?.content[0]?.type).toBe("image");
    expect(figure?.content[1]?.type).toBe("caption");
    expect(figure?.content[1]?.content[0]?.text).toBe("A caption");
  });

  it("omits an empty caption rather than inserting a blank one", () => {
    const state = stateWith(schema.node("paragraph", undefined, [schema.text("Doc")]));
    const next = run(state, insertMedia("image", undefined, { figure: true, caption: "" }));

    const figure = next?.doc.content.find((node) => node.type === "figure");
    expect(figure?.content).toHaveLength(1);
  });

  it("rejects an unknown node type through the schema", () => {
    const state = stateWith(schema.node("paragraph", undefined, [schema.text("Doc")]));
    expect(() => run(state, insertMedia("hologram"))).toThrow();
  });
});

describe("attribute commands", () => {
  it("declines when the selection is not a node selection", () => {
    const state = stateWith(schema.node("image", { src: "https://a.test/x.png" }));
    // Cursor in text, no node selected.
    expect(setMediaAlignment("left")(state)).toBe(false);
    expect(removeMedia(state)).toBe(false);
  });

  it("sets alignment on the selected media", () => {
    const state = stateWith(schema.node("image", { src: "https://a.test/x.png" }), 0);
    const next = run(state, setMediaAlignment("wide"));

    expect(next?.doc.content[0]?.attrs.align).toBe("wide");
  });

  it("resizes and clears dimensions", () => {
    const state = stateWith(schema.node("image", { src: "https://a.test/x.png" }), 0);

    const sized = runOrThrow(state, setMediaSize({ width: 320, height: 240 }));
    expect(sized?.doc.content[0]?.attrs.width).toBe(320);
    expect(sized?.doc.content[0]?.attrs.height).toBe(240);

    // `null` restores the natural size rather than pinning a value.
    const cleared = run(sized, setMediaSize({ width: null }));
    expect(cleared?.doc.content[0]?.attrs.width).toBeNull();
    expect(cleared?.doc.content[0]?.attrs.height).toBe(240);
  });

  it("preserves other attributes when updating one", () => {
    const state = stateWith(schema.node("image", { src: "https://a.test/x.png", alt: "Keep" }), 0);
    const next = run(state, setMediaAlignment("right"));

    expect(next?.doc.content[0]?.attrs.src).toBe("https://a.test/x.png");
    expect(next?.doc.content[0]?.attrs.alt).toBe("Keep");
  });

  it("sets alt text and the explicit decorative flag", () => {
    const state = stateWith(schema.node("image", { src: "https://a.test/x.png" }), 0);

    const described = run(state, setMediaAlt("A cat"));
    expect(described?.doc.content[0]?.attrs.alt).toBe("A cat");
    expect(described?.doc.content[0]?.attrs.decorative).toBe(false);

    const decorative = run(state, setMediaAlt("", { decorative: true }));
    expect(decorative?.doc.content[0]?.attrs.decorative).toBe(true);
  });

  it("rejects invalid values at the call site", () => {
    expect(() => setMediaAlignment("diagonal" as never)).toThrow(/Invalid media alignment/);
    expect(() => setMediaSize({ width: -10 })).toThrow(/non-negative/);
  });

  it("merges arbitrary attributes through setMediaAttrs", () => {
    const state = stateWith(schema.node("video", { src: "https://a.test/v.mp4" }), 0);
    const next = run(state, setMediaAttrs({ poster: "https://a.test/p.jpg", loop: true }));

    expect(next?.doc.content[0]?.attrs.poster).toBe("https://a.test/p.jpg");
    expect(next?.doc.content[0]?.attrs.loop).toBe(true);
  });
});

describe("removeMedia", () => {
  it("removes a bare media node", () => {
    const state = stateWith(schema.node("image", { src: "https://a.test/x.png" }), 0);
    const next = run(state, removeMedia);

    expect(next?.doc.content.some((node) => node.type === "image")).toBe(false);
  });

  it("removes the wrapping figure when the media is its only child", () => {
    // A figure requires media, so removing just the image would leave a figure
    // that fails its own content expression.
    const figure = schema.node("figure", undefined, [
      schema.node("image", { src: "https://a.test/x.png" }),
    ]);
    // Position 1 is inside the figure, where the image sits.
    const state = stateWith(figure, 1);
    const next = run(state, removeMedia);

    expect(next?.doc.content.some((node) => node.type === "figure")).toBe(false);
    expect(next?.doc.content.some((node) => node.type === "image")).toBe(false);
  });

  it("removes the figure when it also holds a caption", () => {
    const figure = schema.node("figure", undefined, [
      schema.node("image", { src: "https://a.test/x.png" }),
      schema.node("caption", undefined, [schema.text("Caption")]),
    ]);
    const state = stateWith(figure, 1);
    const next = run(state, removeMedia);

    // The caption cannot survive without its media, so the whole figure goes.
    expect(next?.doc.content.some((node) => node.type === "figure")).toBe(false);
    expect(JSON.stringify(next?.doc)).not.toContain("Caption");
  });

  it("leaves the resulting document valid", () => {
    const state = stateWith(schema.node("image", { src: "https://a.test/x.png" }), 0);
    const next = run(state, removeMedia);

    // Rebuilding through the schema proves the result still satisfies it.
    expect(() => schema.createDocument([...(next?.doc.content ?? [])])).not.toThrow();
  });
});
