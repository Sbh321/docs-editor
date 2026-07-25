import { EditorDemo } from "./editor-demo";

export default function Page() {
  return (
    <main>
      <h1>Docs Editor — Next.js Example</h1>
      <p>
        The minimal Next.js integration: build a schema, create a document, wrap it in{" "}
        <code>EditorProvider</code>, and render <code>&lt;Editor /&gt;</code>. Both need a client
        boundary (<code>&quot;use client&quot;</code>, see <code>app/editor-demo.tsx</code>) since
        they touch the DOM and hold React state — this page and the root layout stay Server
        Components. <code>nodeRenderers</code> maps <code>paragraph</code> → <code>&lt;p&gt;</code>{" "}
        here — any node/mark without an entry there still falls back to a generic, unstyled element
        named after it, since there&apos;s no theme system yet (Phase 4).
      </p>
      <EditorDemo />
    </main>
  );
}
