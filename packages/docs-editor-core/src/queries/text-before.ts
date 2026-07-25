import { isTextNode } from "../schema";

import type { DocumentNode } from "../schema";

interface TextRun {
  readonly text: string;
  readonly from: number;
}

/**
 * The text preceding `pos` within the textblock that contains it — the string
 * from the start of the current block up to the cursor, and nothing from any
 * other block. Returns `""` when `pos` is in a block with no text (e.g. an
 * empty paragraph) or lies on a block boundary.
 *
 * Pure and engine-agnostic, like {@link import("../search").findText}: it
 * walks the plain `DocumentNode` tree using the same linear position scheme
 * `Transaction`/`EditorState` use. Intended for trigger detection — e.g. a
 * slash menu opening when the text before the cursor is `"/"` followed by a
 * query — without needing a live editor view.
 */
export function getTextBefore(doc: DocumentNode, pos: number): string {
  const runs: TextRun[] = [];
  collectTextRuns(doc, 0, true, runs);
  const segments = mergeAdjacentRuns(runs);

  for (const segment of segments) {
    const end = segment.from + segment.text.length;
    if (pos > segment.from && pos <= end) {
      return segment.text.slice(0, pos - segment.from);
    }
  }
  return "";
}

/** Walks `node`'s subtree, returning the position just past it (mirroring the engine's own position scheme). */
function collectTextRuns(
  node: DocumentNode,
  pos: number,
  isRoot: boolean,
  runs: TextRun[],
): number {
  if (isTextNode(node)) {
    if (node.text.length > 0) {
      runs.push({ text: node.text, from: pos });
    }
    return pos + node.text.length;
  }

  let cursor = isRoot ? pos : pos + 1;
  for (const child of node.content) {
    cursor = collectTextRuns(child, cursor, false, runs);
  }
  return isRoot ? cursor : cursor + 1;
}

/** Joins text runs immediately adjacent (no boundary token between them, i.e. same textblock) into one segment. */
function mergeAdjacentRuns(runs: readonly TextRun[]): readonly TextRun[] {
  const segments: TextRun[] = [];
  for (const run of runs) {
    const last = segments[segments.length - 1];
    if (last && last.from + last.text.length === run.from) {
      segments[segments.length - 1] = { from: last.from, text: last.text + run.text };
    } else {
      segments.push(run);
    }
  }
  return segments;
}
