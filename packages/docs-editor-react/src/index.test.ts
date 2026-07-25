import { describe, expect, it } from "vitest";

import { EditorProvider, useEditor, useEditorDispatch, useEditorState } from "./index";

describe("@sbh321/docs-editor-react public API", () => {
  it("exports EditorProvider and the editor hooks", () => {
    expect(EditorProvider).toBeTypeOf("function");
    expect(useEditorState).toBeTypeOf("function");
    expect(useEditorDispatch).toBeTypeOf("function");
    expect(useEditor).toBeTypeOf("function");
  });
});
