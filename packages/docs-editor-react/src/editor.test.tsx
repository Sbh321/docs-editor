import { createSchema, deleteSelection, EditorState } from "@sbh321/docs-editor-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Editor } from "./editor";
import { EditorProvider } from "./editor-provider";
import { useEditor } from "./use-editor";

function createTestState() {
  const schema = createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: { group: "block", content: "inline*" },
      text: { group: "inline", isText: true, marks: "all" },
    },
  });
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
}

describe("Editor", () => {
  it("mounts an editable DOM node rendering the document's text", () => {
    render(
      <EditorProvider initialState={createTestState()}>
        <Editor className="my-editor" />
      </EditorProvider>,
    );

    const mount = document.querySelector(".my-editor");
    expect(mount).not.toBeNull();
    expect(mount?.textContent).toBe("Hello");
    expect(mount?.querySelector('[contenteditable="true"]')).not.toBeNull();
  });

  it("respects editable={false}", () => {
    render(
      <EditorProvider initialState={createTestState()}>
        <Editor className="my-editor" editable={false} />
      </EditorProvider>,
    );

    const mount = document.querySelector(".my-editor");
    expect(mount?.querySelector('[contenteditable="false"]')).not.toBeNull();
  });

  it("re-renders when a transaction is dispatched from elsewhere in the tree", () => {
    function Toolbar() {
      const { state, dispatch } = useEditor();
      return <button onClick={() => dispatch(state.tr.insertText("Hi "))}>Insert</button>;
    }

    render(
      <EditorProvider initialState={createTestState()}>
        <Toolbar />
        <Editor className="my-editor" />
      </EditorProvider>,
    );

    fireEvent.click(screen.getByText("Insert"));

    expect(document.querySelector(".my-editor")?.textContent).toBe("Hi Hello");
  });

  it("reuses one view across edits instead of remounting it (performance regression guard)", () => {
    // The view must be constructed once and then synced with `updateState`.
    // Recreating it per state change would drop DOM selection, IME composition
    // and scroll position on every keystroke, and re-render the whole document
    // instead of the changed part — see docs/PERFORMANCE.md.
    function Toolbar() {
      const { state, dispatch } = useEditor();
      return <button onClick={() => dispatch(state.tr.insertText("Hi "))}>Insert</button>;
    }

    render(
      <EditorProvider initialState={createTestState()}>
        <Toolbar />
        <Editor className="my-editor" />
      </EditorProvider>,
    );

    const editable = document.querySelector(".my-editor [contenteditable]");
    expect(editable).not.toBeNull();

    fireEvent.click(screen.getByText("Insert"));
    fireEvent.click(screen.getByText("Insert"));

    // Same DOM element instance after multiple edits — the view was updated,
    // not rebuilt.
    expect(document.querySelector(".my-editor [contenteditable]")).toBe(editable);
    expect(document.querySelector(".my-editor")?.textContent).toBe("Hi Hi Hello");
  });

  it("does not remount the view when inline renderer/keymap literals change identity", () => {
    // `nodeRenderers`/`markRenderers`/`keymap` are conventionally written as
    // inline object literals, so they get a fresh identity on every render.
    // Treating that as a reason to rebuild the view would remount the editor
    // constantly; they are captured at mount instead.
    function Wrapper() {
      const [, force] = useState(0);
      return (
        <EditorProvider initialState={createTestState()}>
          <button onClick={() => force((value) => value + 1)}>Re-render</button>
          <Editor className="my-editor" nodeRenderers={{ paragraph: () => ["p", 0] }} />
        </EditorProvider>
      );
    }

    render(<Wrapper />);
    const paragraph = document.querySelector(".my-editor p");
    expect(paragraph).not.toBeNull();

    fireEvent.click(screen.getByText("Re-render"));
    fireEvent.click(screen.getByText("Re-render"));

    expect(document.querySelector(".my-editor p")).toBe(paragraph);
  });

  it("nodeRenderers overrides the generic default for a specific node type", () => {
    render(
      <EditorProvider initialState={createTestState()}>
        <Editor className="my-editor" nodeRenderers={{ paragraph: () => ["p", 0] }} />
      </EditorProvider>,
    );

    const mount = document.querySelector(".my-editor");
    expect(mount?.querySelector("p")?.textContent).toBe("Hello");
    expect(mount?.querySelector("paragraph")).toBeNull();
  });

  it("keymap runs a bound Command when its key combo is pressed", () => {
    const schema = createSchema({
      topNode: "doc",
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { group: "block", content: "inline*" },
        text: { group: "inline", isText: true, marks: "all" },
      },
    });
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);
    // A non-empty selection, since deleteSelection reports false (and never
    // dispatches) when the selection is collapsed.
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } });

    render(
      <EditorProvider initialState={state}>
        <Editor className="my-editor" keymap={{ "Ctrl-d": deleteSelection }} />
      </EditorProvider>,
    );

    const editable = document.querySelector(".my-editor [contenteditable='true']");
    expect(editable).not.toBeNull();

    fireEvent.keyDown(editable as Element, {
      key: "d",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    expect(document.querySelector(".my-editor")?.textContent).toBe("");
  });

  it("unmounts cleanly without throwing", () => {
    function Wrapper() {
      const [mounted, setMounted] = useState(true);
      return (
        <EditorProvider initialState={createTestState()}>
          {mounted && <Editor />}
          <button onClick={() => setMounted(false)}>unmount</button>
        </EditorProvider>
      );
    }

    render(<Wrapper />);
    expect(() => fireEvent.click(screen.getByText("unmount"))).not.toThrow();
  });
});
