import { isTextNode } from "../schema";

import type { DocumentNode } from "../schema";

/** One heading in a document's {@link getOutline outline}. */
export interface OutlineEntry {
  /** The heading's level (e.g. `1` for an H1), read from its level attribute. */
  readonly level: number;
  /** The heading's plain-text content, with all inline formatting flattened away. */
  readonly text: string;
  /**
   * The position directly before the heading node, in the same linear scheme
   * `Transaction`/`EditorState` use. `from + 1` is the first position *inside*
   * the heading — use that to place a cursor at its start
   * (`tr.setSelection({ anchor: from + 1, head: from + 1 })`).
   */
  readonly from: number;
  /** The position directly after the heading node (`from` + its size). */
  readonly to: number;
}

export interface OutlineOptions {
  /** The node type that represents a heading. Defaults to `"heading"`. */
  readonly headingType?: string;
  /** The attribute holding a heading's level. Defaults to `"level"`. */
  readonly levelAttr?: string;
}

/**
 * Extracts the heading structure of `doc` in document order — the data behind
 * an outline panel or table of contents. Each entry carries the heading's
 * level, flattened text, and position range.
 *
 * Pure and engine-agnostic, like {@link import("../search").findText}: it
 * walks the plain `DocumentNode` tree with no `EditorState`/engine involved.
 * Which node type counts as a heading, and where its level lives, are explicit
 * options (defaulting to `"heading"`/`"level"`) rather than assumed — the core
 * models no fixed schema, so a document using different names stays supported.
 */
export function getOutline(doc: DocumentNode, options?: OutlineOptions): readonly OutlineEntry[] {
  const headingType = options?.headingType ?? "heading";
  const levelAttr = options?.levelAttr ?? "level";
  const entries: OutlineEntry[] = [];
  collect(doc, 0, true, headingType, levelAttr, entries);
  return entries;
}

/** Walks `node`'s subtree, appending any headings found, and returns the position just past `node`. */
function collect(
  node: DocumentNode,
  pos: number,
  isRoot: boolean,
  headingType: string,
  levelAttr: string,
  entries: OutlineEntry[],
): number {
  if (isTextNode(node)) {
    return pos + node.text.length;
  }

  let cursor = isRoot ? pos : pos + 1;
  for (const child of node.content) {
    cursor = collect(child, cursor, false, headingType, levelAttr, entries);
  }
  const end = isRoot ? cursor : cursor + 1;

  if (!isRoot && node.type === headingType) {
    const level = node.attrs[levelAttr];
    entries.push({
      level: typeof level === "number" ? level : 1,
      text: textContent(node),
      from: pos,
      to: end,
    });
  }
  return end;
}

/** Concatenates every descendant text node's string, flattening inline structure and marks. */
function textContent(node: DocumentNode): string {
  if (isTextNode(node)) {
    return node.text;
  }
  let text = "";
  for (const child of node.content) {
    text += textContent(child);
  }
  return text;
}
