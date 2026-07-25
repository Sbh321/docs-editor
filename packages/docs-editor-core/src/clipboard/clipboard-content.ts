import type { DocumentNode } from "../schema";

/**
 * A copyable range of document content. `openStart`/`openEnd` record how
 * many levels are "unclosed" at each end (e.g. copying from the middle of
 * one paragraph to the middle of another produces two partial paragraphs,
 * each open by one level) — mirroring how ProseMirror's `Slice` lets a paste
 * correctly rejoin with the surrounding content instead of nesting a
 * fragment of a paragraph inside another paragraph.
 *
 * Plain, JSON-safe data (same philosophy as `DocumentNode`) — no engine or
 * state dependency, so both `../engine` and `../state` can depend on this
 * without an inverted layering (the same reasoning as `../selection`).
 */
export interface ClipboardContent<NodeName extends string = string> {
  readonly content: readonly DocumentNode<NodeName>[];
  readonly openStart: number;
  readonly openEnd: number;
}

/** Whether a copied range contains no content at all. */
export function isClipboardContentEmpty(content: ClipboardContent): boolean {
  return content.content.length === 0;
}
