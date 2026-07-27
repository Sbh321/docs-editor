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
    const blocks = Array.from(container.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    if (blocks.length === 0) {
      appliedRef.current = new Map();
      setPageCount((current) => (current !== 1 ? 1 : current));
      setDecorations((current) => (current.length > 0 ? [] : current));
      return;
    }

    // Effective CSS scale from ancestor transforms (zoom), so measurements are
    // in unscaled layout px.
    const scale =
      container.offsetWidth > 0
        ? container.getBoundingClientRect().width / container.offsetWidth
        : 1;
    const safeScale = scale > 0 ? scale : 1;
    const containerTop = container.getBoundingClientRect().top;
    const applied = appliedRef.current;

    // Natural (spacing-independent) top and height of each block.
    let cumulativeApplied = 0;
    const naturals = blocks.map((el, index) => {
      cumulativeApplied += applied.get(index) ?? 0;
      const rect = el.getBoundingClientRect();
      return {
        top: (rect.top - containerTop) / safeScale - cumulativeApplied,
        height: rect.height / safeScale,
      };
    });

    // One pass: decide where breaks fall and how much spacing each needs.
    const nextBreaks = new Map<number, number>();
    let contentBottomEff = pageContentPx;
    let addedOffset = 0;
    let pages = 1;
    for (let index = 0; index < naturals.length; index += 1) {
      const block = naturals[index];
      if (!block) {
        continue;
      }
      const effTop = block.top + addedOffset;
      const effBottom = effTop + block.height;
      if (block.height <= pageContentPx && effBottom > contentBottomEff + OVERFLOW_EPSILON) {
        const nextTopEff = contentBottomEff + interGapPx;
        const spacer = nextTopEff - effTop;
        if (spacer > 0) {
          nextBreaks.set(index, spacer);
          addedOffset += spacer;
        }
        contentBottomEff = nextTopEff + pageContentPx;
        pages += 1;
      } else if (block.height > pageContentPx) {
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
    const schedule = () => {
      if (rafRef.current !== null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    };

    if (!enabled || !view || typeof ResizeObserver === "undefined") {
      schedule(); // resets to a single unpaginated page (see `measure`)
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }

    const observer = new ResizeObserver(schedule);
    observer.observe(view.dom);
    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, view, measure]);

  useDecorations(decorations, PAGINATION_DECORATION_SOURCE);

  return { pageCount: enabled ? pageCount : 1 };
}
