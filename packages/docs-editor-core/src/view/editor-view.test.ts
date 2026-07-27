import { describe, expect, it } from "vitest";

import { toggleMark } from "../commands";
import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import { EditorView } from "./editor-view";

function createTestState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
}

describe("EditorView", () => {
  it("mounts an editable DOM node containing the document's text", () => {
    const mount = document.createElement("div");
    const view = new EditorView(mount, { state: createTestState() });

    expect(mount.contains(view.dom)).toBe(true);
    expect(view.dom.textContent).toBe("Hello");
    expect(view.dom.getAttribute("contenteditable")).toBe("true");

    view.destroy();
  });

  it("respects editable: false", () => {
    const mount = document.createElement("div");
    const view = new EditorView(mount, { state: createTestState(), editable: false });

    expect(view.dom.getAttribute("contenteditable")).toBe("false");

    view.destroy();
  });

  it("updateState() re-renders the DOM to match the new state", () => {
    const mount = document.createElement("div");
    const state = createTestState();
    const view = new EditorView(mount, { state });

    const nextState = state.apply(state.tr.insertText("Hi "));
    view.updateState(nextState);

    expect(view.dom.textContent).toBe("Hi Hello");

    view.destroy();
  });

  it("destroy() removes the view's DOM node from its mount", () => {
    const mount = document.createElement("div");
    const view = new EditorView(mount, { state: createTestState() });
    const { dom } = view;

    view.destroy();

    expect(mount.contains(dom)).toBe(false);
  });

  it("nodeRenderers overrides the generic default for a specific node type", () => {
    const mount = document.createElement("div");
    const view = new EditorView(mount, {
      state: createTestState(),
      nodeRenderers: { paragraph: () => ["p", 0] },
    });

    expect(view.dom.querySelector("p")?.textContent).toBe("Hello");
    expect(view.dom.querySelector("paragraph")).toBeNull();

    view.destroy();
  });

  it("markRenderers renders an attribute-driven mark (a link's href) and leaves other marks on the generic default", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("Docs", [schema.mark("link", { href: "https://example.com" })]),
        schema.text(" Editor", [schema.mark("bold")]),
      ]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
    const mount = document.createElement("div");

    const view = new EditorView(mount, {
      state,
      // "bold" deliberately has no entry here.
      markRenderers: { link: (mark) => ["a", { href: String(mark.attrs.href) }, 0] },
    });

    const link = view.dom.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.textContent).toBe("Docs");
    expect(view.dom.querySelector("bold")?.textContent).toBe(" Editor");

    view.destroy();
  });

  it("reuses the same DOM node across a content-only update", () => {
    const mount = document.createElement("div");
    const state = createTestState();
    const view = new EditorView(mount, {
      state,
      nodeRenderers: { paragraph: () => ["p", 0] },
    });

    const paragraphBefore = view.dom.querySelector("p");
    view.updateState(state.apply(state.tr.insertText("Hi ")));
    const paragraphAfter = view.dom.querySelector("p");

    expect(paragraphAfter).toBe(paragraphBefore);
    expect(paragraphAfter?.textContent).toBe("Hi Hello");

    view.destroy();
  });

  it("keymap runs a bound Command's dispatched transaction through dispatchTransaction", () => {
    const mount = document.createElement("div");
    const state = createTestState();
    let dispatched: unknown;

    const view = new EditorView(mount, {
      state,
      dispatchTransaction: (transaction) => {
        dispatched = transaction;
      },
      keymap: { "Ctrl-b": toggleMark("bold") },
    });

    // Select the whole word so toggleMark has a non-empty range to act on.
    view.updateState(state.apply(state.tr.setSelection({ anchor: 1, head: 6 })));

    const handled = view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true, cancelable: true }),
    );

    expect(handled).toBe(false); // event.preventDefault() was called, so dispatchEvent returns false.
    expect(dispatched).toBeDefined();

    view.destroy();
  });

  it("keymap reports unhandled keys normally (no binding fires)", () => {
    const mount = document.createElement("div");
    let dispatched = false;

    const view = new EditorView(mount, {
      state: createTestState(),
      dispatchTransaction: () => {
        dispatched = true;
      },
      keymap: { "Ctrl-b": toggleMark("bold") },
    });

    view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "x", ctrlKey: true, bubbles: true, cancelable: true }),
    );

    expect(dispatched).toBe(false);

    view.destroy();
  });

  it("setDecorations paints a range and clears it, without a transaction", () => {
    const mount = document.createElement("div");
    let dispatched = false;
    const view = new EditorView(mount, {
      state: createTestState(),
      dispatchTransaction: () => {
        dispatched = true;
      },
      nodeRenderers: { paragraph: () => ["p", 0] },
    });

    // Highlight "Hel" (positions 1..4).
    view.setDecorations([{ from: 1, to: 4, attributes: { class: "search-match" } }]);
    const highlight = view.dom.querySelector(".search-match");
    expect(highlight?.textContent).toBe("Hel");
    // Setting decorations is view state, never a document edit.
    expect(dispatched).toBe(false);

    view.setDecorations([]);
    expect(view.dom.querySelector(".search-match")).toBeNull();

    view.destroy();
  });

  it("accepts initial decorations and clamps out-of-range positions instead of throwing", () => {
    const mount = document.createElement("div");
    const view = new EditorView(mount, {
      state: createTestState(),
      nodeRenderers: { paragraph: () => ["p", 0] },
      // `to` past the end of the document — must be clamped, not throw.
      decorations: [{ from: 1, to: 9999, attributes: { class: "hl" } }],
    });

    expect(view.dom.querySelector(".hl")?.textContent).toBe("Hello");

    view.destroy();
  });

  it("posAtDOM maps a block element back to a document position", () => {
    const mount = document.createElement("div");
    const view = new EditorView(mount, {
      state: createTestState(),
      nodeRenderers: { paragraph: () => ["p", 0] },
    });

    const paragraph = view.dom.querySelector("p");
    expect(paragraph).not.toBeNull();
    // Offset 0 inside the paragraph resolves to the position just inside it
    // (the node starts at 0, its content at 1).
    expect(view.posAtDOM(paragraph as Node, 0)).toBe(1);

    view.destroy();
  });

  it("applies a node decoration's style to the block element (page-break spacing)", () => {
    const mount = document.createElement("div");
    const view = new EditorView(mount, {
      state: createTestState(),
      nodeRenderers: { paragraph: () => ["p", 0] },
    });

    // The whole paragraph node spans 0..(its nodeSize). A node decoration
    // attributes the block element itself — here a top margin.
    view.setDecorations([
      { from: 0, to: 7, type: "node", attributes: { style: "margin-top: 120px" } },
    ]);

    const paragraph = view.dom.querySelector("p");
    expect(paragraph?.getAttribute("style")).toContain("margin-top: 120px");

    view.destroy();
  });

  it("composes decorations from independent sources without clobbering", () => {
    const mount = document.createElement("div");
    const view = new EditorView(mount, {
      state: createTestState(),
      nodeRenderers: { paragraph: () => ["p", 0] },
    });

    view.setDecorations([{ from: 1, to: 4, attributes: { class: "search" } }], "search");
    view.setDecorations(
      [{ from: 0, to: 7, type: "node", attributes: { class: "paged" } }],
      "pagination",
    );

    // Both sources are present at once.
    expect(view.dom.querySelector(".search")?.textContent).toBe("Hel");
    expect(view.dom.querySelector("p.paged")).not.toBeNull();

    // Clearing one source leaves the other intact.
    view.setDecorations([], "search");
    expect(view.dom.querySelector(".search")).toBeNull();
    expect(view.dom.querySelector("p.paged")).not.toBeNull();

    view.destroy();
  });

  it("keeps decorations applied across an updateState re-render", () => {
    const mount = document.createElement("div");
    const state = createTestState();
    const view = new EditorView(mount, {
      state,
      nodeRenderers: { paragraph: () => ["p", 0] },
    });

    view.setDecorations([{ from: 1, to: 4, attributes: { class: "hl" } }]);
    expect(view.dom.querySelector(".hl")?.textContent).toBe("Hel");

    // A document edit shifts text; decorations are resolved against the new
    // doc each render (here the same absolute range now covers different text)
    // and must still render rather than being dropped or throwing.
    view.updateState(state.apply(state.tr.insertText("XY ")));
    expect(view.dom.querySelector(".hl")).not.toBeNull();

    view.destroy();
  });
});
