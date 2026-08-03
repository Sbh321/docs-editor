import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { useDecorations } from "../use-decorations";
import { useEditorView } from "../use-editor-view";

import { usePageLayout } from "./use-page-layout";

import type { Decoration, LengthUnit } from "@sbh321/docs-editor-core";

/** The decoration source pagination contributes under (composes with search, etc.). */
export const PAGINATION_DECORATION_SOURCE = "pagination";

/** CSS px per inch at the standard 96dpi CSS reference. */
const PX_PER_IN = 96;
/** Visual gap between page sheets, in px. Matches the canvas look. */
export const PAGE_GAP_PX = 24;
/** Tolerance (px) so a block ending a hair past a page boundary doesn't break. */
const OVERFLOW_EPSILON = 2;

/**
 * Quiet period before re-paginating, in ms.
 *
 * Re-flowing pages on every keystroke is what made pagination cost ~2.8 ms per
 * keystroke on a 100-page document — not the measurement itself, which is
 * ~0.6 ms (see docs/PERFORMANCE.md). Page breaks are only meaningful once a
 * word or line is finished, so the work is deferred until typing pauses, which
 * takes it off the per-keystroke path entirely. Chosen to be below the ~200 ms
 * gap that reads as "responsive" while comfortably longer than the gap between
 * keystrokes of even a fast typist.
 */
const REPAGINATE_IDLE_MS = 120;

/**
 * Hard ceiling on how long re-pagination can be deferred while input keeps
 * arriving, so continuous typing (or a held key) cannot starve it indefinitely.
 */
const REPAGINATE_MAX_WAIT_MS = 500;

function toPx(value: number, unit: LengthUnit): number {
  return unit === "in" ? value * PX_PER_IN : (value * PX_PER_IN) / 25.4;
}

/** A stable string key for a break map, to detect when the layout actually changed. */
function keyOf(breaks: ReadonlyMap<number, number>): string {
  return [...breaks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, px]) => `${index}:${Math.round(px)}`)
    .join(",");
}

export interface PaginationResult {
  /** The number of page sheets the content currently spans (≥ 1). */
  readonly pageCount: number;
}

/**
 * Live pagination: measures the editor's rendered blocks and inserts page-break
 * spacing (as node {@link Decoration}s carrying a `margin-top`) so content flows
 * onto separate page sheets, recomputing on every document, layout, or size
 * change. Returns the current page count for the surface to draw its sheets.
 *
 * The measurement is done in *natural* coordinates (each block's position with
 * the currently-applied break spacing subtracted), which are independent of the
 * spacing we add — so recomputation converges in one extra pass instead of
 * oscillating. Measurements are divided by the effective CSS scale, so it stays
 * correct under zoom. Blocks taller than a page overflow rather than split (a
 * documented limitation).
 *
 * Keeps the editor a single contenteditable — nothing is inserted into the
 * document; page breaks are purely visual decorations.
 */
export function usePagination(enabled: boolean): PaginationResult {
  const view = useEditorView();
  const { layout, dimensions } = usePageLayout();

  const [pageCount, setPageCount] = useState(1);
  const [decorations, setDecorations] = useState<readonly Decoration[]>([]);
  // The break spacing currently reflected in the DOM (index → px), so natural
  // positions can be recovered by subtracting it from measured positions.
  const appliedRef = useRef<Map<number, number>>(new Map());
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRequestRef = useRef<number | null>(null);

  const pageHeightPx = toPx(dimensions.height, dimensions.unit);
  const topPx = toPx(layout.margins.top, layout.margins.unit);
  const bottomPx = toPx(layout.margins.bottom, layout.margins.unit);
  const pageContentPx = Math.max(1, pageHeightPx - topPx - bottomPx);
  const interGapPx = topPx + bottomPx + PAGE_GAP_PX;

  const measure = useCallback(() => {
    if (!enabled || !view) {
      appliedRef.current = new Map();
      setDecorations((current) => (current.length > 0 ? [] : current));
      setPageCount((current) => (current !== 1 ? 1 : current));
      return;
    }

    const container = view.dom;
    const blocks: HTMLElement[] = [];
    for (const child of container.children) {
      if (child instanceof HTMLElement) {
        blocks.push(child);
      }
    }
    if (blocks.length === 0) {
      appliedRef.current = new Map();
      setPageCount((current) => (current !== 1 ? 1 : current));
      setDecorations((current) => (current.length > 0 ? [] : current));
      return;
    }

    const applied = appliedRef.current;

    // Measurement and break placement in a single pass over the blocks.
    //
    // `offsetTop`/`offsetHeight` rather than `getBoundingClientRect()`: not for
    // speed — measured over 1000 blocks the two are near-identical (0.73 ms vs
    // 0.61 ms, so rects are if anything marginally faster) — but because they
    // are *untransformed* layout values. That removes the zoom scale-correction
    // factor and the two extra container rect reads it needed, which is one
    // less thing to get wrong. Positions are taken relative to the first block,
    // which shares an offset parent with the rest and never carries break
    // spacing itself, so the origin is stable.
    //
    // The pass itself is not the expensive part of pagination (see
    // docs/PERFORMANCE.md); scheduling is.
    const origin = blocks[0]?.offsetTop ?? 0;

    const nextBreaks = new Map<number, number>();
    let contentBottomEff = pageContentPx;
    let addedOffset = 0;
    let cumulativeApplied = 0;
    let pages = 1;

    for (let index = 0; index < blocks.length; index += 1) {
      const el = blocks[index];
      if (!el) {
        continue;
      }
      // Subtract the spacing already applied above this block to recover its
      // *natural* position — spacing-independent, so the computation converges
      // instead of feeding back on itself.
      cumulativeApplied += applied.get(index) ?? 0;
      const naturalTop = el.offsetTop - origin - cumulativeApplied;
      const height = el.offsetHeight;

      const effTop = naturalTop + addedOffset;
      const effBottom = effTop + height;
      if (height <= pageContentPx && effBottom > contentBottomEff + OVERFLOW_EPSILON) {
        const nextTopEff = contentBottomEff + interGapPx;
        const spacer = nextTopEff - effTop;
        if (spacer > 0) {
          nextBreaks.set(index, spacer);
          addedOffset += spacer;
        }
        contentBottomEff = nextTopEff + pageContentPx;
        pages += 1;
      } else if (height > pageContentPx) {
        // Taller than a page: advance the boundary past it (no split).
        while (contentBottomEff < effBottom) {
          contentBottomEff += pageContentPx + interGapPx;
          pages += 1;
        }
      }
    }

    if (keyOf(nextBreaks) === keyOf(applied)) {
      // Converged — only the page count may still need syncing.
      setPageCount((current) => (current !== pages ? pages : current));
      return;
    }

    appliedRef.current = nextBreaks;
    const nextDecorations: Decoration[] = [];
    for (const [index, spacer] of nextBreaks) {
      const el = blocks[index];
      if (!el) {
        continue;
      }
      const from = view.posAtDOM(el, 0) - 1;
      const nextEl = blocks[index + 1];
      const to = nextEl ? view.posAtDOM(nextEl, 0) - 1 : Number.MAX_SAFE_INTEGER;
      nextDecorations.push({
        from,
        to,
        type: "node",
        attributes: { style: `margin-top: ${Math.round(spacer)}px` },
      });
    }
    setDecorations(nextDecorations);
    setPageCount(pages);
  }, [enabled, view, pageContentPx, interGapPx]);

  // A single effect drives all measurement. Every `setState` happens inside a
  // `requestAnimationFrame` (never synchronously in the effect), so it can't
  // cascade renders. Measurement runs:
  //  - initially and on layout change: a fresh `ResizeObserver` fires once when
  //    it starts observing, and this effect re-subscribes whenever `measure`
  //    changes (i.e. when the page layout changes);
  //  - on content resize: the observer fires as the editor grows/shrinks
  //    (including when our own break spacing is applied — that's the
  //    convergence loop, which settles in one extra pass).
  useLayoutEffect(() => {
    const cancelPending = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    /**
     * Runs a measurement after `delayMs` of quiet, replacing any pass already
     * queued. The trailing `requestAnimationFrame` guarantees the read happens
     * after the browser has settled layout, and every `setState` happens inside
     * it — never synchronously in this effect, so it cannot cascade renders.
     */
    const runAfter = (delayMs: number) => {
      cancelPending();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          firstRequestRef.current = null;
          measure();
        });
      }, delayMs);
    };

    if (!enabled || !view || typeof ResizeObserver === "undefined") {
      runAfter(0); // resets to a single unpaginated page (see `measure`)
      return cancelPending;
    }

    const observer = new ResizeObserver(() => {
      // Every resize goes through the same debounce, including the one caused
      // by our own break spacing landing (the convergence pass). Fast-pathing
      // that follow-up was tried and reverted: it let the
      // measure → apply → observe cycle re-enter without settling, leaving
      // content permanently in motion, and it also gave back most of the
      // per-keystroke win. Uniform debouncing is what makes the loop quiesce.
      //
      // Debounce to the end of a typing burst, but never defer past the max
      // wait — otherwise sustained input could postpone re-pagination forever.
      const now = performance.now();
      firstRequestRef.current ??= now;
      const deferredFor = now - firstRequestRef.current;
      runAfter(deferredFor >= REPAGINATE_MAX_WAIT_MS ? 0 : REPAGINATE_IDLE_MS);
    });
    observer.observe(view.dom);
    // First pass: paginate what is already on screen without waiting for input.
    runAfter(0);

    return () => {
      observer.disconnect();
      cancelPending();
      firstRequestRef.current = null;
    };
  }, [enabled, view, measure]);

  useDecorations(decorations, PAGINATION_DECORATION_SOURCE);

  return { pageCount: enabled ? pageCount : 1 };
}
