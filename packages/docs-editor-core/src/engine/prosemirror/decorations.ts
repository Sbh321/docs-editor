import { Decoration as ProseMirrorDecoration, DecorationSet } from "prosemirror-view";

import type { Decoration } from "../../decoration";
import type { Node as ProseMirrorNode } from "prosemirror-model";

/** Opaque handle to the engine's decoration-set representation. */
export type EngineDecorationSet = DecorationSet;

/**
 * Builds a `prosemirror-view` `DecorationSet` from docs-editor's plain
 * {@link Decoration}s, against `doc`.
 *
 * Positions are clamped to the document's bounds and zero-width entries are
 * dropped, so a set built from positions that belong to a slightly different
 * document (a stale frame between a doc edit and the consumer recomputing its
 * decorations) is rendered harmlessly rather than throwing — the next
 * recompute corrects it. This is what lets decorations be recomputed on every
 * change instead of position-mapped through transactions.
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
    if (to > from) {
      engineDecorations.push(ProseMirrorDecoration.inline(from, to, { ...decoration.attributes }));
    }
  }
  return DecorationSet.create(doc, engineDecorations);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Holds the current decorations for one view, plus a one-entry memo so the
 * `DecorationSet` is only rebuilt when the decorations or the document actually
 * change — the view asks for decorations on every render, so this keeps
 * unrelated re-renders (typing elsewhere) from rebuilding the set.
 */
export interface DecorationHolder {
  decorations: readonly Decoration[];
  cache: {
    readonly doc: ProseMirrorNode;
    readonly decorations: readonly Decoration[];
    readonly set: EngineDecorationSet;
  } | null;
}

export function createDecorationHolder(decorations: readonly Decoration[]): DecorationHolder {
  return { decorations, cache: null };
}

export function setHolderDecorations(
  holder: DecorationHolder,
  decorations: readonly Decoration[],
): void {
  holder.decorations = decorations;
}

/** The decoration set for `doc`, rebuilt only when `doc` or the holder's decorations changed. */
export function resolveDecorationSet(
  holder: DecorationHolder,
  doc: ProseMirrorNode,
): EngineDecorationSet {
  const { cache, decorations } = holder;
  if (cache && cache.doc === doc && cache.decorations === decorations) {
    return cache.set;
  }
  const set = buildEngineDecorationSet(doc, decorations);
  holder.cache = { doc, decorations, set };
  return set;
}
