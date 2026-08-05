/**
 * The default document preset — the `@sbh321/docs-editor-core/preset` entry
 * point (ROADMAP Phase 8, Milestone 8.1).
 *
 * A complete, ready-to-use schema with the renderers, parse rules and key
 * bindings that go with it, so an editor can be assembled without first writing
 * ~250 lines of configuration:
 *
 * ```ts
 * import { EditorState } from "@sbh321/docs-editor-core";
 * import { defaultSchema, defaultKeymap } from "@sbh321/docs-editor-core/preset";
 *
 * const state = EditorState.create({ schema: defaultSchema, doc, history: true });
 * ```
 *
 * It sits behind its own entry point for the same reason `/tables` does: a
 * consumer with their own schema should not pay for this one. Importing it is
 * what pulls it into your bundle.
 *
 * **Framework-agnostic.** Nothing here imports React — it is document-model
 * data, usable from a server render, the Markdown and DOCX exporters, and any
 * future adapter. The type names match `defaultMarkdownSpec` and
 * `defaultDocxSpec`, so documents built on this schema export to every format
 * with no mapping configuration.
 */

export * from "./preset/index";
