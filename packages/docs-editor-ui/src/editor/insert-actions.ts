/**
 * Insertion building blocks shared by the insert menu and the slash menu
 * (ROADMAP Phase 9, Milestone 9.10).
 *
 * One module on purpose: both menus insert the same things, and until this
 * existed the table builder lived in the insert menu while the slash menu's
 * items were example code each application rewrote. Two lists of "what can be
 * inserted" is how the two menus drift apart.
 */

import { setBlockType, toggleList, wrapIn } from "@sbh321/docs-editor-core";

import type { Command, DocumentNode, Schema } from "@sbh321/docs-editor-core";
import type { SlashMenuItem } from "@sbh321/docs-editor-react";

/** Builds a table of `rows` × `columns` with a header row. */
export function buildTable(schema: Schema, rows: number, columns: number): DocumentNode {
  const cell = (type: string) =>
    schema.node(type, undefined, [schema.node("paragraph", undefined, [])]);
  const rowNodes = Array.from({ length: rows }, (_, row) =>
    schema.node(
      "table_row",
      undefined,
      Array.from({ length: columns }, () => cell(row === 0 ? "table_header" : "table_cell")),
    ),
  );
  return schema.node("table", undefined, rowNodes);
}

/** Inserts a table at the selection. Declines when the schema has no tables. */
export function insertTable(rows = 3, columns = 3): Command {
  return (state, dispatch) => {
    if (!("table" in state.schema.spec.nodes)) {
      return false;
    }
    dispatch?.(state.tr.insertNode(buildTable(state.schema, rows, columns)));
    return true;
  };
}

/** Inserts a divider at the selection. Declines when the schema has none. */
export function insertDivider(): Command {
  return (state, dispatch) => {
    if (!("divider" in state.schema.spec.nodes)) {
      return false;
    }
    dispatch?.(state.tr.insertNode(state.schema.node("divider")));
    return true;
  };
}

/**
 * Runs `command` only when the schema declares `nodeName`.
 *
 * The default items below are written against the default schema, but a
 * consumer extends or replaces it — and a slash item whose command *throws* on
 * an unknown type takes the whole menu down, where one that declines simply
 * does nothing.
 */
function whenNodeExists(nodeName: string, command: Command): Command {
  return (state, dispatch) => nodeName in state.schema.spec.nodes && command(state, dispatch);
}

/**
 * The slash menu's default items (ROADMAP Phase 9, Milestone 9.10).
 *
 * Everything the default schema can insert or become, so `/` is a complete
 * command palette out of the box rather than a stub the application must
 * finish. Each item names its icon by theme intent and carries the keywords
 * people actually type (`h2`, `todo`, `ol`, `hr`).
 *
 * A **function**, not an exported constant, for the same reason as
 * `mediaNodeSpecs()`: a top-level array whose entries call command factories is
 * a module side effect no bundler can prove away, and it cost the
 * primitives-only consumer bundle 25 KB of editor code the moment this module
 * existed. Called lazily, it costs only the consumers who render a slash menu.
 */
export function defaultSlashItems(): readonly SlashMenuItem[] {
  return [
    {
      id: "h1",
      label: "Heading 1",
      keywords: ["h1", "title"],
      iconName: "heading1",
      command: whenNodeExists("heading", setBlockType("heading", { level: 1 })),
    },
    {
      id: "h2",
      label: "Heading 2",
      keywords: ["h2", "subtitle"],
      iconName: "heading2",
      command: whenNodeExists("heading", setBlockType("heading", { level: 2 })),
    },
    {
      id: "h3",
      label: "Heading 3",
      keywords: ["h3"],
      iconName: "heading3",
      command: whenNodeExists("heading", setBlockType("heading", { level: 3 })),
    },
    {
      id: "bullet",
      label: "Bullet list",
      keywords: ["ul", "unordered"],
      iconName: "bulletList",
      command: whenNodeExists("bullet_list", toggleList("bullet_list")),
    },
    {
      id: "numbered",
      label: "Numbered list",
      keywords: ["ol", "ordered"],
      iconName: "orderedList",
      command: whenNodeExists("ordered_list", toggleList("ordered_list")),
    },
    {
      id: "checklist",
      label: "Checklist",
      keywords: ["todo", "task"],
      iconName: "taskList",
      command: whenNodeExists("task_list", toggleList("task_list")),
    },
    {
      id: "quote",
      label: "Quote",
      keywords: ["blockquote"],
      iconName: "quote",
      command: whenNodeExists("blockquote", wrapIn("blockquote")),
    },
    {
      id: "code",
      label: "Code block",
      keywords: ["pre", "snippet"],
      iconName: "code",
      command: whenNodeExists("code_block", setBlockType("code_block")),
    },
    { id: "table", label: "Table", keywords: ["grid"], iconName: "table", command: insertTable() },
    {
      id: "divider",
      label: "Divider",
      keywords: ["hr", "rule", "separator"],
      iconName: "divider",
      command: insertDivider(),
    },
  ];
}
