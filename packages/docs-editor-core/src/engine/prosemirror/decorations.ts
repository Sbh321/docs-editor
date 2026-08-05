import { Decoration as ProseMirrorDecoration, DecorationSet } from "prosemirror-view";

import type { Decoration } from "../../decoration";
import type { Node as ProseMirrorNode } from "prosemirror-model";

/** Opaque handle to the engine's decoration-set representation. */
export type EngineDecorationSet = DecorationSet;

/**
 * Builds a `prosemirror-view` `DecorationSet` from docs-editor's plain
 * {@link Decoration}s, against `doc`.
 *
 * Positions are clamped to the document's bounds, zero-width entries are
 * dropped, and a node decoration whose range has drifted off a node boundary
 * snaps to the enclosing top-level block rather than disappearing. Together
 * these make a set built from positions belonging to a slightly different
 * document (the stale frame between a doc edit and the consumer recomputing)
 * render *stably* rather than flicker — which is what lets decorations be
 * recomputed on every change instead of position-mapped through transactions.
 */
export function buildEngineDecorationSet(
  doc: ProseMirrorNode,
  decorations: readonly Decoration[],
): EngineDecorationSet {
  const max = doc.content.size;
  const engineDecorations: ProseMirrorDecoration[] = [];
  for (const decoration of decorations) {
    const from = clamp(decoration.from, 0, max);
    const to = clamp(decoration.to, from, max);
    if (to <= from) {
      continue;
    }
    if (decoration.type === "node") {
      // Node decorations attribute the block's own DOM element (e.g. spacing
      // to push it onto the next page). `nodeName` is an inline-only concept.
      const { nodeName: _nodeName, ...attributes } = decoration.attributes;

      // The engine silently drops a node decoration whose range does not
      // *exactly* span a node — and between a keystroke and the consumer
      // recomputing, every stored position after the edit is off by the length
      // of what was typed. For pagination that meant page-break spacing
      // vanishing for a frame or two on each keystroke and reappearing after
      // the re-measure: the page visibly snapped. When the range has drifted,
      // snap it to the top-level block containing `from` instead — the next
      // recompute lands on the same block, so nothing moves twice.
      let nodeFrom = from;
      let nodeTo = to;
      const exact = doc.nodeAt(from);
      if (!exact || from + exact.nodeSize !== to) {
        const $from = doc.resolve(Math.min(from + 1, max));
        if ($from.depth < 1) {
          continue; // No enclosing block to attach to; drop harmlessly.
        }
        nodeFrom = $from.before(1);
        nodeTo = $from.after(1);
      }
      engineDecorations.push(ProseMirrorDecoration.node(nodeFrom, nodeTo, { ...attributes }));
    } else {
      engineDecorations.push(ProseMirrorDecoration.inline(from, to, { ...decoration.attributes }));
    }
  }
  return DecorationSet.create(doc, engineDecorations);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** The default source key used when a caller doesn't name one. */
export const DEFAULT_DECORATION_SOURCE = "default";

/**
 * Holds the current decorations for one view, keyed by *source* so independent
 * contributors (search highlighting, pagination spacers, comment ranges) can
 * coexist — each replaces only its own entry, and the rendered set is their
 * union. A `version` counter + one-entry memo keeps the `DecorationSet` from
 * being rebuilt on unrelated re-renders (the view asks for decorations on every
 * render).
 */
export interface DecorationHolder {
  readonly sources: Map<string, readonly Decoration[]>;
  version: number;
  cache: {
    readonly doc: ProseMirrorNode;
    readonly version: number;
    readonly set: EngineDecorationSet;
  } | null;
}

export function createDecorationHolder(decorations: readonly Decoration[]): DecorationHolder {
  const sources = new Map<string, readonly Decoration[]>();
  if (decorations.length > 0) {
    sources.set(DEFAULT_DECORATION_SOURCE, decorations);
  }
  return { sources, version: 0, cache: null };
}

/** Replaces the decorations contributed by `source` (empty removes the source). */
export function setHolderDecorations(
  holder: DecorationHolder,
  decorations: readonly Decoration[],
  source: string = DEFAULT_DECORATION_SOURCE,
): void {
  if (decorations.length > 0) {
    holder.sources.set(source, decorations);
  } else {
    holder.sources.delete(source);
  }
  holder.version += 1;
}

/** The decoration set for `doc` (the union of all sources), rebuilt only when `doc` or a source changed. */
export function resolveDecorationSet(
  holder: DecorationHolder,
  doc: ProseMirrorNode,
): EngineDecorationSet {
  const { cache, version } = holder;
  if (cache && cache.doc === doc && cache.version === version) {
    return cache.set;
  }
  const all: Decoration[] = [];
  for (const decorations of holder.sources.values()) {
    all.push(...decorations);
  }
  const set = buildEngineDecorationSet(doc, all);
  holder.cache = { doc, version, set };
  return set;
}
