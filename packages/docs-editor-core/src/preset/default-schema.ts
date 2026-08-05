/**
 * The default document schema (ROADMAP Phase 8, Milestone 8.1).
 *
 * Until now the only complete schema in the repository was example code inside
 * the playground, which meant every consumer wrote ~250 lines of schema,
 * renderers and parse rules before they had an editor. This is that schema,
 * shipped.
 *
 * **Framework-agnostic on purpose.** It is plain document-model data, so the
 * Markdown and DOCX exporters, a server-side render, and a future non-React
 * adapter can all use it. That is why it lives in the core behind the
 * `@sbh321/docs-editor-core/preset` entry point rather than in a React package.
 *
 * The type names deliberately match `defaultMarkdownSpec` and `defaultDocxSpec`,
 * so a document built on this schema exports to every format with no mapping
 * configuration at all.
 *
 * ## Stability
 *
 * These names are a **public API**: a document saved today must still load
 * tomorrow. Renaming a node or mark here is a breaking change for every stored
 * document, so additions are cheap and renames are not.
 */

import { fontSizeMarkSpec, linkMarkSpec, paragraphFormattingAttrs } from "../formatting";
import { listStyleAttrs, taskListNodeSpecs } from "../lists";
import { mediaNodeSpecs } from "../media";
import { createSchema } from "../schema";

import type { MarkSpec, NodeSpec, Schema } from "../schema";

/** Node type names in {@link defaultSchema}. */
export type DefaultNodeName =
  | "doc"
  | "paragraph"
  | "heading"
  | "blockquote"
  | "bullet_list"
  | "ordered_list"
  | "list_item"
  | "task_list"
  | "task_item"
  | "code_block"
  | "divider"
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "embed"
  | "figure"
  | "caption"
  | "table"
  | "table_row"
  | "table_cell"
  | "table_header";

/** Mark type names in {@link defaultSchema}. */
export type DefaultMarkName =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "link"
  | "highlight"
  | "text_color"
  | "font_family"
  | "font_size";

/** The default text colour, used when a `text_color` mark carries no explicit one. */
export const DEFAULT_TEXT_COLOR = "#111111";

/** The default highlight colour — a marker-pen yellow. */
export const DEFAULT_HIGHLIGHT_COLOR = "#fef08a";

/**
 * The default font stack. Arial with fallbacks, because it is the font people
 * expect a document editor to open in and it renders everywhere.
 */
export const DEFAULT_FONT_FAMILY = "Arial, Helvetica, sans-serif";

/** The node specs {@link defaultSchema} is built from, exported so they can be reused piecemeal. */
export const defaultNodeSpecs: Readonly<Record<DefaultNodeName, NodeSpec>> = {
  doc: { content: "block+" },
  // Every textblock carries alignment and indentation (Phase 9). They are
  // spread rather than written out so a renderer, parse rule and exporter
  // cannot disagree about the attribute names.
  paragraph: { group: "block", content: "inline*", attrs: { ...paragraphFormattingAttrs() } },
  heading: {
    group: "block",
    content: "inline*",
    attrs: { level: { default: 1 }, ...paragraphFormattingAttrs() },
  },
  blockquote: { group: "block", content: "block+" },
  bullet_list: { group: "block", content: "list_item+", attrs: { ...listStyleAttrs() } },
  ordered_list: {
    group: "block",
    content: "list_item+",
    attrs: { order: { default: 1 }, ...listStyleAttrs() },
  },
  list_item: { content: "paragraph block*" },

  // Checklists (Phase 9). Their own node types rather than a `checked` flag on
  // `list_item` — see `../lists/list-node-specs.ts` for why.
  ...taskListNodeSpecs(),
  // `marks: "none"` so formatting cannot be applied inside code, and `code: true`
  // so the engine treats it as a code context (Enter inserts a newline).
  code_block: {
    group: "block",
    content: "text*",
    marks: "none",
    code: true,
    attrs: { ...paragraphFormattingAttrs() },
  },
  // No `content` at all: a leaf the cursor cannot enter.
  divider: { group: "block" },
  text: { group: "inline", isText: true, marks: "all" },

  // Media (Phase 7). Spread from the shipped catalog rather than re-declared, so
  // the preset cannot drift from the media commands and serializers.
  ...mediaNodeSpecs(),

  // Tables. `table_row`'s content references the shared `tablecell` *group*
  // rather than an alternation, since the content grammar resolves groups.
  // `tableRole` is what the engine's table support keys off; cells are
  // `isolating` so edits stay inside a cell.
  table: { group: "block", content: "table_row+", tableRole: "table", isolating: true },
  table_row: { content: "tablecell+", tableRole: "row" },
  table_cell: {
    content: "block+",
    group: "tablecell",
    tableRole: "cell",
    isolating: true,
    attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
  },
  table_header: {
    content: "block+",
    group: "tablecell",
    tableRole: "header_cell",
    isolating: true,
    attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
  },
};

/** The mark specs {@link defaultSchema} is built from. */
export const defaultMarkSpecs: Readonly<Record<DefaultMarkName, MarkSpec>> = {
  bold: {},
  italic: {},
  underline: {},
  strikethrough: {},
  // Inline code excludes every other mark — text cannot be bold *and* code.
  code: { excludes: "_" },
  // From the shared spec, so the commands, renderer and parse rules cannot
  // disagree about which attributes a link carries.
  link: linkMarkSpec(),
  highlight: { attrs: { color: { default: DEFAULT_HIGHLIGHT_COLOR } } },
  text_color: { attrs: { color: { default: DEFAULT_TEXT_COLOR } } },
  font_family: { attrs: { family: { default: DEFAULT_FONT_FAMILY } } },
  font_size: fontSizeMarkSpec(),
};

/** A schema typed by {@link defaultSchema}'s node and mark names. */
export type DefaultSchema = Schema<DefaultNodeName, DefaultMarkName>;

/**
 * A complete document schema: prose, headings, lists, quotes, code, dividers,
 * media, tables, and the formatting marks a document editor is expected to
 * have.
 *
 * ```ts
 * import { defaultSchema } from "@sbh321/docs-editor-core/preset";
 *
 * const state = EditorState.create({ schema: defaultSchema, doc, history: true });
 * ```
 */
export const defaultSchema: DefaultSchema = createSchema({
  topNode: "doc",
  nodes: defaultNodeSpecs,
  marks: defaultMarkSpecs,
});

export interface SchemaExtension {
  /** Node types to add, or existing ones to replace. */
  readonly nodes?: Readonly<Record<string, NodeSpec>>;
  /** Mark types to add, or existing ones to replace. */
  readonly marks?: Readonly<Record<string, MarkSpec>>;
}

/**
 * Builds a schema from {@link defaultSchema} plus your own types.
 *
 * Additive by default — the entries you pass are merged over the defaults, so
 * adding a `callout` node leaves everything else intact:
 *
 * ```ts
 * const schema = extendDefaultSchema({
 *   nodes: { callout: { group: "block", content: "block+" } },
 *   marks: { superscript: {} },
 * });
 * ```
 *
 * Passing a name that already exists **replaces** that spec rather than merging
 * into it, so overriding one field means spreading the original:
 *
 * ```ts
 * extendDefaultSchema({
 *   nodes: { heading: { ...defaultNodeSpecs.heading, attrs: { level: { default: 2 } } } },
 * });
 * ```
 *
 * The result is typed by the *default* names, since the added ones are only
 * known to the caller. Declare a union and cast when you need them typed:
 *
 * ```ts
 * const schema = extendDefaultSchema({ nodes: { callout } }) as Schema<
 *   DefaultNodeName | "callout",
 *   DefaultMarkName
 * >;
 * ```
 */
export function extendDefaultSchema(extension: SchemaExtension = {}): DefaultSchema {
  return createSchema({
    topNode: "doc",
    nodes: { ...defaultNodeSpecs, ...extension.nodes },
    marks: { ...defaultMarkSpecs, ...extension.marks },
  });
}
