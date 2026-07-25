import { isTextNode } from "../schema";

import type { DocumentNode } from "../schema";

/** A single match's range — usable directly as `from`/`to` on `Transaction`/`EditorState` methods. */
export interface SearchMatch {
  readonly from: number;
  readonly to: number;
}

export interface FindTextOptions {
  /** Whether the match must have identical case. Defaults to `false` (like a browser's find). */
  readonly caseSensitive?: boolean;
}

interface TextRun {
  readonly text: string;
  readonly from: number;
}

/**
 * Finds every occurrence of `query` in `doc`, returning each as a `{ from,
 * to }` range in the same position scheme `Transaction`/`EditorState` use
 * (each non-text node's opening/closing boundary counts as one position;
 * text contributes its length) — so a match can be passed straight to
 * `state.tr.insertText(replacement, match.from, match.to)` to replace it
 * ("Replace" is just that; it doesn't need its own primitive). Matches
 * correctly span adjacent inline nodes within the same textblock (e.g. a
 * mark boundary splitting "World" into "Wor" + "ld"), since text runs with
 * no gap between them are joined before searching, but never span a block
 * boundary (there's always a gap there, from the boundary tokens between
 * sibling blocks) — matching how a search feature is normally expected to
 * behave, not a limitation of this implementation.
 *
 * Pure and framework/engine-agnostic: operates on the plain `DocumentNode`
 * tree only, no `EditorState`/engine involved, so it can run anywhere a
 * document exists (including outside a live editor).
 */
export function findText(
  doc: DocumentNode,
  query: string,
  options?: FindTextOptions,
): readonly SearchMatch[] {
  if (query.length === 0) {
    return [];
  }

  const runs: TextRun[] = [];
  collectTextRuns(doc, 0, true, runs);
  const segments = mergeAdjacentRuns(runs);

  const caseSensitive = options?.caseSensitive ?? false;
  const normalizedQuery = caseSensitive ? query : query.toLowerCase();

  const matches: SearchMatch[] = [];
  for (const segment of segments) {
    const haystack = caseSensitive ? segment.text : segment.text.toLowerCase();
    let index = haystack.indexOf(normalizedQuery);
    while (index !== -1) {
      matches.push({ from: segment.from + index, to: segment.from + index + query.length });
      index = haystack.indexOf(normalizedQuery, index + 1);
    }
  }
  return matches;
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

/** Joins text runs that are immediately adjacent (no boundary token between them) into one segment. */
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
