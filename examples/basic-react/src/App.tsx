import { DocsEditor } from "@sbh321/docs-editor";

import "@sbh321/docs-editor/styles.css";

/**
 * The minimal integration: install one package, import the stylesheet, render
 * the component. That is the whole example — everything else (schema, toolbar,
 * page layout, media, light and dark) is a default rather than something you
 * assemble.
 *
 * The one prop is layout, which is the application's to decide: by default the
 * editor fills the element it is put in and forces no size of its own, and this
 * example has no such element. `height="viewport"` says "you *are* the page".
 * An editor inside a pane, a tab or a flex column leaves this off and gives its
 * container a height instead.
 */
export function App() {
  return (
    <>
      <div style={{ height: "90vh", width: "80vw" }}>
        <DocsEditor />
      </div>
    </>
  );
}
