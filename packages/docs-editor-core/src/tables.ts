/**
 * Table editing support — the `@sbh321/docs-editor-core/tables` entry point.
 *
 * Interactive table editing (rectangular cell selection, arrow-key navigation
 * between cells, automatic repair of malformed tables after edits) is a
 * sizeable chunk of machinery, so it lives behind its own entry point and is
 * installed by passing it to `EditorState.create`:
 *
 * ```ts
 * import { EditorState } from "@sbh321/docs-editor-core";
 * import { tableEditing } from "@sbh321/docs-editor-core/tables";
 *
 * EditorState.create({ schema, doc, tables: tableEditing });
 * ```
 *
 * Importing it is what pulls the implementation into your bundle — a document
 * that never uses tables never pays for them. The table *commands*
 * (`addRowAfter`, `mergeCells`, …) remain on the main entry point: they operate
 * on the document model and are useful without the interactive plugin, though
 * they assume a document this plugin keeps well-formed.
 */

import { createEngineTablePlugin } from "./engine";

import type { EditorPlugin } from "./state";

/**
 * Enables interactive table editing. Pass to `EditorState.create`'s `tables`
 * option. Only meaningful for a schema that declares table node types (see
 * `NodeSpec.tableRole`).
 */
export const tableEditing: EditorPlugin = {
  createEnginePlugin: () => createEngineTablePlugin(),
};
