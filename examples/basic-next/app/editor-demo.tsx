"use client";

import { createSchema, EditorState } from "@sbh321/docs-editor-core";
import { Editor, EditorProvider } from "@sbh321/docs-editor-react";

// A minimal schema: a document of paragraphs containing plain text.
const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true },
  },
});

const doc = schema.createDocument([
  schema.node("paragraph", undefined, [schema.text("Hello from Docs Editor.")]),
]);
const initialState = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

/**
 * `EditorProvider`/`Editor` touch the DOM and hold React state, so they need
 * a client boundary — the rest of this app (the layout, this file's parent
 * page) stays a Server Component.
 */
export function EditorDemo() {
  return (
    <EditorProvider initialState={initialState}>
      <Editor nodeRenderers={{ paragraph: () => ["p", 0] }} />
    </EditorProvider>
  );
}
