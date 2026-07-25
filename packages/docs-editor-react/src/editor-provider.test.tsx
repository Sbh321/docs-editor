import { createSchema, EditorState } from "@sbh321/docs-editor-core";
import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditorProvider } from "./editor-provider";
import { useEditor } from "./use-editor";
import { useEditorDispatch } from "./use-editor-dispatch";
import { useEditorState } from "./use-editor-state";

import type { ReactNode } from "react";

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

function wrapperFor(initialState: EditorState, onStateChange?: (state: EditorState) => void) {
  return function Wrapper({ children }: { children: ReactNode }) {
    if (onStateChange) {
      return (
        <EditorProvider initialState={initialState} onStateChange={onStateChange}>
          {children}
        </EditorProvider>
      );
    }
    return <EditorProvider initialState={initialState}>{children}</EditorProvider>;
  };
}

describe("useEditorState / useEditorDispatch", () => {
  it("throw when used outside an EditorProvider", () => {
    expect(() => renderHook(() => useEditorState())).toThrow(/EditorProvider/);
    expect(() => renderHook(() => useEditorDispatch())).toThrow(/EditorProvider/);
  });

  it("exposes the initial state", () => {
    const { result } = renderHook(() => useEditorState(), {
      wrapper: wrapperFor(createTestState()),
    });

    expect(result.current.doc.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("updates the state when a transaction is dispatched", () => {
    const { result } = renderHook(() => useEditor(), {
      wrapper: wrapperFor(createTestState()),
    });

    act(() => {
      result.current.dispatch(result.current.state.tr.insertText("Hi "));
    });

    expect(result.current.state.doc.content[0]?.content[0]?.text).toBe("Hi Hello");
  });

  it("keeps the dispatch function reference stable across state changes", () => {
    const { result } = renderHook(() => useEditor(), {
      wrapper: wrapperFor(createTestState()),
    });

    const firstDispatch = result.current.dispatch;
    act(() => {
      result.current.dispatch(result.current.state.tr.insertText("Hi "));
    });

    expect(result.current.dispatch).toBe(firstDispatch);
  });

  it("calls onStateChange after a dispatched transaction", () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useEditor(), {
      wrapper: wrapperFor(createTestState(), onStateChange),
    });

    act(() => {
      result.current.dispatch(result.current.state.tr.insertText("Hi "));
    });

    expect(onStateChange).toHaveBeenCalledWith(result.current.state);
  });
});

describe("EditorProvider", () => {
  it("renders its children", () => {
    render(
      <EditorProvider initialState={createTestState()}>
        <div>child content</div>
      </EditorProvider>,
    );

    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
