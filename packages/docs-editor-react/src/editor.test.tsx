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
