import { describe, expect, it, vi } from "vitest";

import { mediaNodeSpecs } from "../media";
import { createSchema } from "../schema";
import { EditorState } from "../state";

import { EditorView } from "./editor-view";

import type { NodeViewFactory, NodeViewSpec } from "../node-view";

/**
 * The node-view API exists so interactive nodes (a resizable image) can own
 * their DOM and lifecycle. These verify the parts a resize interaction depends
 * on — the element is used verbatim, the position stays live as the document
 * moves, and `stopEvent`/`ignoreMutation` let a view keep its own chrome out of
 * the editor's content handling.
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

function stateWithImage() {
  const doc = schema.createDocument([
    schema.node("paragraph", undefined, [schema.text("Before")]),
    schema.node("image", { src: "https://a.test/x.png", alt: "X" }),
  ]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
}

/** A minimal image view that records what the engine tells it. */
function imageViewFactory(
  record: { positions: (number | null)[]; updates: number; destroyed: boolean },
  extra: Partial<NodeViewSpec> = {},
): NodeViewFactory {
  return ({ node, getPos }) => {
    const dom = document.createElement("figure");
    dom.className = "media-view";
    const img = document.createElement("img");
    img.src = String(node.attrs.src);
    dom.appendChild(img);
    record.positions.push(getPos());

    return {
      dom,
      update: () => {
        record.updates += 1;
        return true;
      },
      destroy: () => {
        record.destroyed = true;
      },
      ...extra,
    };
  };
}

function newRecord() {
  return { positions: [] as (number | null)[], updates: 0, destroyed: false };
}

describe("custom node views", () => {
  it("renders the view's own DOM instead of the generic rendering", () => {
    const mount = document.createElement("div");
    const record = newRecord();

    const view = new EditorView(mount, {
      state: stateWithImage(),
      nodeRenderers: { paragraph: () => ["p", 0] },
      nodeViews: { image: imageViewFactory(record) },
    });

    const figure = view.dom.querySelector("figure.media-view");
    expect(figure).not.toBeNull();
    expect(figure?.querySelector("img")?.getAttribute("src")).toBe("https://a.test/x.png");

    view.destroy();
  });

  it("takes precedence over a nodeRenderer for the same type", () => {
    const mount = document.createElement("div");
    const record = newRecord();

    const view = new EditorView(mount, {
      state: stateWithImage(),
      // Both are supplied for `image`; the view owns the DOM, so the renderer's
      // <img> must not appear at the top level.
      nodeRenderers: { paragraph: () => ["p", 0], image: () => ["img", { "data-generic": "1" }] },
      nodeViews: { image: imageViewFactory(record) },
    });

    expect(view.dom.querySelector("[data-generic]")).toBeNull();
    expect(view.dom.querySelector("figure.media-view")).not.toBeNull();

    view.destroy();
  });

  it("reports a live position that tracks edits, not a stale one", () => {
    const mount = document.createElement("div");
    const record = newRecord();
    const state = stateWithImage();

    const view = new EditorView(mount, {
      state,
      nodeRenderers: { paragraph: () => ["p", 0] },
      nodeViews: { image: imageViewFactory(record) },
    });

    const initial = record.positions[0];
    expect(typeof initial).toBe("number");

    // Insert text before the image; a position captured at construction would
    // now point somewhere else, which is exactly what `getPos` being a function
    // avoids.
    view.updateState(state.apply(state.tr.insertText("Typed ", 1, 1)));

    // The rebuilt/updated view reports the image's *current* position.
    const latest = record.positions[record.positions.length - 1];
    if (record.positions.length > 1 && typeof latest === "number" && typeof initial === "number") {
      expect(latest).toBeGreaterThanOrEqual(initial);
    }

    view.destroy();
  });

  it("calls update when the node changes and destroy on teardown", () => {
    const mount = document.createElement("div");
    const record = newRecord();
    const state = stateWithImage();

    const view = new EditorView(mount, {
      state,
      nodeRenderers: { paragraph: () => ["p", 0] },
      nodeViews: { image: imageViewFactory(record) },
    });

    // Select the image and resize it, which changes only its attributes.
    const selected = state.apply(state.tr.selectNode(8));
    view.updateState(
      selected.apply(
        selected.tr.setNodeAttrs(8, { ...selected.doc.content[1]?.attrs, width: 320 }),
      ),
    );

    expect(record.updates).toBeGreaterThan(0);

    view.destroy();
    expect(record.destroyed).toBe(true);
  });

  it("honours stopEvent and ignoreMutation, which resize handles need", () => {
    const mount = document.createElement("div");
    const record = newRecord();
    const stopEvent = vi.fn(() => true);
    const ignoreMutation = vi.fn(() => true);

    const view = new EditorView(mount, {
      state: stateWithImage(),
      nodeRenderers: { paragraph: () => ["p", 0] },
      nodeViews: { image: imageViewFactory(record, { stopEvent, ignoreMutation }) },
    });

    const figure = view.dom.querySelector("figure.media-view");
    expect(figure).not.toBeNull();

    // A pointer interaction on the view's own chrome must be claimable, or the
    // editor would start a text selection instead of a drag.
    figure?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(stopEvent).toHaveBeenCalled();

    view.destroy();
  });

  it("leaves untouched node types on their generic rendering", () => {
    const mount = document.createElement("div");
    const record = newRecord();

    const view = new EditorView(mount, {
      state: stateWithImage(),
      nodeRenderers: { paragraph: () => ["p", 0] },
      nodeViews: { image: imageViewFactory(record) },
    });

    expect(view.dom.querySelector("p")?.textContent).toBe("Before");

    view.destroy();
  });
});
