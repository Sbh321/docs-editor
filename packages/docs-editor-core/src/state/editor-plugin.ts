/**
 * An opaque handle to an optional editor capability that a state can install —
 * currently table editing, from `@sbh321/docs-editor-core/tables`.
 *
 * Capabilities are **passed in** rather than switched on with a boolean so that
 * a consumer who never uses one does not pay for it. A flag forces the core to
 * import every capability's implementation unconditionally — the reference sits
 * in a branch no bundler can prove is unreachable — which is exactly what made
 * a headless bundle carry the whole table-editing stack: 37.6 KB gzip, 51% of
 * its size, for a feature it never enabled (see docs/PERFORMANCE.md).
 *
 * It also matches CLAUDE.md's rule that plugins should *extend* the core rather
 * than be baked into it.
 *
 * The shape is deliberately opaque and its internals are stripped from the
 * published types: obtain one by importing it from its subpath, never by
 * constructing it by hand.
 *
 * ```ts
 * import { EditorState } from "@sbh321/docs-editor-core";
 * import { tableEditing } from "@sbh321/docs-editor-core/tables";
 *
 * EditorState.create({ schema, doc, tables: tableEditing });
 * ```
 */
export interface EditorPlugin {
  /**
   * @internal Builds the engine-level plugin. Returns `unknown` so no engine
   * type crosses the package boundary; the engine casts it back. Stripped from
   * the public `.d.ts` by `stripInternal`.
   */
  readonly createEnginePlugin: () => unknown;
}
