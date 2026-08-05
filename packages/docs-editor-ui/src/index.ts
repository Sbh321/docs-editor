/**
 * `@sbh321/docs-editor` — the batteries-included editor (ROADMAP Phase 8).
 *
 * The other packages are headless by design, which is what makes them
 * composable and what made assembling an editor a ~1,800-line job. This is the
 * assembled one:
 *
 * ```tsx
 * import { DocsEditor } from "@sbh321/docs-editor";
 * import "@sbh321/docs-editor/styles.css";
 *
 * export default () => <DocsEditor />;
 * ```
 *
 * Three layers, in descending order of control — drop down whenever the one
 * above stops fitting:
 *
 * | Need                          | Use                                |
 * | ----------------------------- | ---------------------------------- |
 * | A working editor              | `<DocsEditor />`                   |
 * | Our styled parts, your layout | this package's components          |
 * | Your own design system        | `@sbh321/docs-editor-react`        |
 *
 * Opinions live here; **behaviour does not**. Every control delegates to a core
 * command, exactly as the headless UI layer does.
 */

export { cn } from "./class-names";
export * from "./editor";
export { editorTheme, editorThemeClassNames } from "./editor-theme";
export * from "./primitives";
export { DOCS_EDITOR_TOKENS } from "./tokens";

export type { ClassValue } from "./class-names";
export type { DocsEditorToken } from "./tokens";
export * from "./shell";
