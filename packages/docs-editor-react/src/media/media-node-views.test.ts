import { createSchema, EditorState, mediaNodeSpecs } from "@sbh321/docs-editor-core";
import { describe, expect, it } from "vitest";

import { createMediaNodeViews } from "./media-node-views";

import type { NodeViewSpec } from "@sbh321/docs-editor-core";

/**
 * Media node-view accessibility (ROADMAP Phase 7, Milestone 7.8).
 *
 * Dragging a corner is a pointer gesture with no keyboard equivalent, and
 * CLAUDE.md treats an accessibility regression as a bug — so keyboard
 * operability and the ARIA surface are asserted here rather than assumed.
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

/**
 * Builds a node view for `node` with the node selected, plus a bridge that
 * records what the view dispatches.
 */
type MediaNode = ReturnType<typeof schema.node>;

function mountMedia(node: MediaNode, type = "image") {
  const doc = schema.createDocument([
    node,
    schema.node("paragraph", undefined, [schema.text("After")]),
  ]);
  let state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
  state = state.apply(state.tr.selectNode(0));

  const dispatched: unknown[] = [];
  const views = createMediaNodeViews({
    bridge: {
      getState: () => state,
      dispatch: (transaction) => {
        dispatched.push(transaction);
        // The bridge is typed against the default (string) node names, which is
        // what `useEditorState`/`useEditorDispatch` hand real consumers. This
        // test builds a concretely-typed state, so the two meet here.
        state = state.apply(transaction as Parameters<typeof state.apply>[0]);
      },
    },
  });

  const factory = views[type];
  if (!factory) {
    throw new Error(`No node view registered for "${type}".`);
  }
  const view: NodeViewSpec = factory({ node, getPos: () => 0 });

  return {
    view,
    wrapper: view.dom,
    dispatched,
    currentNode: () => state.doc.content[0],
  };
}

/** Sends a keydown to the wrapper, returning whether the default was prevented. */
function press(wrapper: HTMLElement, key: string, modifiers: KeyboardEventInit = {}): boolean {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  wrapper.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("media node view accessibility", () => {
  it("is focusable and announced as a named group", () => {
    const { wrapper } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", alt: "A cat" }),
    );

    // Without a tabindex the node is unreachable by keyboard at all.
    expect(wrapper.tabIndex).toBe(0);
    expect(wrapper.getAttribute("role")).toBe("group");
    expect(wrapper.getAttribute("aria-label")).toBe("image: A cat");
  });

  it("says so when an image has no description", () => {
    const { wrapper } = mountMedia(schema.node("image", { src: "https://a.test/x.png" }));

    // Silence would be indistinguishable from a described image; naming the
    // gap is what makes it fixable.
    expect(wrapper.getAttribute("aria-label")).toBe("image (no description)");
  });

  it("announces a decorative image as decorative", () => {
    const { wrapper } = mountMedia(
      schema.node("image", { src: "https://a.test/line.png", decorative: true }),
    );

    expect(wrapper.getAttribute("aria-label")).toBe("Decorative image");
    // The inner image keeps an empty alt so assistive technology skips it.
    expect(wrapper.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("names an attachment by its filename", () => {
    const { wrapper } = mountMedia(
      schema.node("file", { src: "https://a.test/r.pdf", filename: "report.pdf" }),
      "file",
    );

    expect(wrapper.getAttribute("aria-label")).toBe("file: report.pdf");
  });

  it("relabels itself when alt text is edited", () => {
    const { view, wrapper } = mountMedia(schema.node("image", { src: "https://a.test/x.png" }));

    view.update?.(schema.node("image", { src: "https://a.test/x.png", alt: "Now described" }));

    // A stale label would keep announcing the old description forever.
    expect(wrapper.getAttribute("aria-label")).toBe("image: Now described");
  });

  it("updates the image's own alt when it is edited, not just the wrapper", () => {
    // Regression: the element is rebuilt only when `src` changes, so editing
    // alt text used to update the wrapper's label while the image itself kept
    // announcing its original description — the attribute a screen reader
    // actually reads.
    const { view, wrapper } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", alt: "Before" }),
    );

    view.update?.(schema.node("image", { src: "https://a.test/x.png", alt: "After" }));

    expect(wrapper.querySelector("img")?.getAttribute("alt")).toBe("After");
  });

  it("empties the image's alt when it becomes decorative", () => {
    const { view, wrapper } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", alt: "A cat" }),
    );

    view.update?.(schema.node("image", { src: "https://a.test/x.png", decorative: true }));

    expect(wrapper.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("keeps the element itself across an alt edit, so nothing re-fetches", () => {
    const { view, wrapper } = mountMedia(schema.node("image", { src: "https://a.test/x.png" }));
    const before = wrapper.querySelector("img");

    view.update?.(schema.node("image", { src: "https://a.test/x.png", alt: "Described" }));

    // Rebuilding would also fix the alt, but at the cost of a re-fetch on every
    // keystroke — and a restarted video for the video node view.
    expect(wrapper.querySelector("img")).toBe(before);
  });

  it("retitles an embed when its description is edited", () => {
    const { view, wrapper } = mountMedia(
      schema.node("embed", { src: "https://a.test/e" }),
      "embed",
    );

    view.update?.(schema.node("embed", { src: "https://a.test/e", alt: "A chart" }));

    expect(wrapper.querySelector("iframe")?.getAttribute("title")).toBe("A chart");
  });

  it("exposes selection to assistive technology, not just as a class", () => {
    const { view, wrapper } = mountMedia(schema.node("image", { src: "https://a.test/x.png" }));

    view.selectNode?.();
    expect(wrapper.getAttribute("aria-selected")).toBe("true");

    view.deselectNode?.();
    expect(wrapper.hasAttribute("aria-selected")).toBe(false);
  });
});

describe("keyboard-operable resize", () => {
  it("widens on ArrowRight", () => {
    const { wrapper, currentNode } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", width: 200 }),
    );

    expect(press(wrapper, "ArrowRight")).toBe(true);
    expect(currentNode()?.attrs.width).toBe(216);
  });

  it("narrows on ArrowLeft", () => {
    const { wrapper, currentNode } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", width: 200 }),
    );

    press(wrapper, "ArrowLeft");
    expect(currentNode()?.attrs.width).toBe(184);
  });

  it("takes a larger step with Shift held", () => {
    const { wrapper, currentNode } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", width: 200 }),
    );

    press(wrapper, "ArrowRight", { shiftKey: true });
    // Fine control by default, quick spans on request.
    expect(currentNode()?.attrs.width).toBe(264);
  });

  it("keeps the aspect ratio when both dimensions are explicit", () => {
    const { wrapper, currentNode } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", width: 200, height: 100 }),
    );

    press(wrapper, "ArrowRight", { shiftKey: true });
    expect(currentNode()?.attrs.width).toBe(264);
    expect(currentNode()?.attrs.height).toBe(132);
  });

  it("does not resize audio, which has no meaningful width", () => {
    const { wrapper, dispatched } = mountMedia(
      schema.node("audio", { src: "https://a.test/a.mp3", width: 200 }),
      "audio",
    );

    press(wrapper, "ArrowRight");
    expect(dispatched).toHaveLength(0);
  });

  it("leaves unrelated keys to the editor", () => {
    const { wrapper, dispatched } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", width: 200 }),
    );

    // Swallowing these would trap the caret on the media node.
    expect(press(wrapper, "ArrowDown")).toBe(false);
    expect(press(wrapper, "a")).toBe(false);
    expect(dispatched).toHaveLength(0);
  });
});

describe("keyboard-operable alignment", () => {
  it("aligns left on Alt+ArrowLeft", () => {
    const { wrapper, currentNode } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png" }),
    );

    expect(press(wrapper, "ArrowLeft", { altKey: true })).toBe(true);
    expect(currentNode()?.attrs.align).toBe("left");
  });

  it("aligns right on Alt+ArrowRight", () => {
    const { wrapper, currentNode } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png" }),
    );

    press(wrapper, "ArrowRight", { altKey: true });
    expect(currentNode()?.attrs.align).toBe("right");
  });

  it("aligns rather than resizes when Alt is held", () => {
    const { wrapper, currentNode } = mountMedia(
      schema.node("image", { src: "https://a.test/x.png", width: 200 }),
    );

    press(wrapper, "ArrowRight", { altKey: true });
    expect(currentNode()?.attrs.width).toBe(200);
    expect(currentNode()?.attrs.align).toBe("right");
  });
});
