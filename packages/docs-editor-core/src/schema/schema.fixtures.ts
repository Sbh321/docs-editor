import { createSchema } from "./schema";

import type { Schema } from "./schema";

export type FixtureNodeName =
  | "doc"
  | "paragraph"
  | "heading"
  | "blockquote"
  | "bullet_list"
  | "ordered_list"
  | "list_item"
  | "divider"
  | "code_block"
  | "image"
  | "figure"
  | "caption"
  | "table"
  | "table_row"
  | "table_cell"
  | "table_header"
  | "text";
export type FixtureMarkName = "bold" | "link";

export function createFixtureSchema(): Schema<FixtureNodeName, FixtureMarkName> {
  return createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
      blockquote: { group: "block", content: "block+" },
      bullet_list: { group: "block", content: "list_item+" },
      ordered_list: { group: "block", content: "list_item+", attrs: { order: { default: 1 } } },
      list_item: { content: "paragraph block*" },
      // No `content` at all: a leaf node — no children ever allowed.
      divider: { group: "block" },
      code_block: { group: "block", content: "text*", marks: "none", code: true },
      // `src` needs a default (even an empty string) so `image` is
      // "generatable" — required in `figure`'s content below, and
      // ProseMirror's schema compiler rejects a non-optional content
      // position filled by a node type it can't construct from defaults
      // alone (verified via a real, actionable error, not assumed).
      image: { group: "block", attrs: { src: { default: "" }, alt: { default: "" } } },
      figure: { group: "block", content: "image caption?" },
      caption: { content: "inline*" },
      // Tables. `table_row`'s content uses the shared "tablecell" *group*
      // (declared by both cell types) rather than `(table_cell |
      // table_header)+` — the content grammar has no alternation, but the
      // matcher resolves group references, so this expresses "any cells"
      // without needing it. `tableRole` is what the engine's table support
      // keys off; cells carry colspan/rowspan (colwidth for future resizing)
      // and are `isolating` so edits stay within a cell.
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
      text: { group: "inline", isText: true, marks: "all" },
    },
    marks: {
      bold: {},
      link: { attrs: { href: {} } },
    },
  });
}
