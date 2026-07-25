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

export function App() {
  return (
    <EditorProvider initialState={initialState}>
      <main>
        <h1>Docs Editor — Basic React Example</h1>
        <p>
          The minimal integration: build a schema, create a document, wrap your app in{" "}
          <code>EditorProvider</code>, and render <code>&lt;Editor /&gt;</code>.{" "}
          <code>nodeRenderers</code> maps <code>paragraph</code> → <code>&lt;p&gt;</code> here — any
          node/mark without an entry there still falls back to a generic, unstyled element named
          after it, since there's no theme system yet (Phase 4).
        </p>
        <Editor nodeRenderers={{ paragraph: () => ["p", 0] }} />
      </main>
    </EditorProvider>
  );
}
