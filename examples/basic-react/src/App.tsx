import { DocsEditor } from "@sbh321/docs-editor";

import "@sbh321/docs-editor/styles.css";

/**
 * The minimal integration: install one package, import the stylesheet, render
 * the component. That is the whole example — everything else (schema, toolbar,
 * page layout, media, light and dark) is a default rather than something you
 * assemble.
 */
export function App() {
  return <DocsEditor />;
}
