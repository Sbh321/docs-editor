import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "../class-names";
import { Popover } from "../primitives/popover";

import type { ReactNode } from "react";

export interface OverflowRowProps {
  /** Accessible name for the overflow trigger. Defaults to `"More tools"`. */
  readonly overflowLabel?: string;
  readonly className?: string;
  /** Groups to lay out. Each direct child is kept whole — never split. */
  readonly children: ReactNode;
}

/**
 * A row that moves whatever does not fit into an overflow menu
 * (ROADMAP Phase 8, Milestone 8.4).
 *
 * The playground's toolbar simply overflowed: on a narrow window its controls
 * wrapped onto a second row, pushing the document down, or ran off the edge
 * where they could not be reached at all. Neither is acceptable in a shell that
 * fills the viewport.
 *
 * ## How it decides
 *
 * The obvious implementation — render a hidden mirror of every item and measure
 * that — works, but it puts a **second copy of every control in the DOM**.
 * Duplicated form controls break `getByLabelText` in a consumer's tests, double
 * the toolbar's render cost on every keystroke, and rely on `aria-hidden` and
 * `inert` to stay harmless.
 *
 * So instead this drops one item at a time and re-measures, which converges in
 * a handful of passes and needs no duplicate tree. The naive version of that
 * oscillates: removing an item frees space, which makes it look like it fits,
 * so it comes back and immediately overflows again. The fix is to remember the
 * width at which each item was removed and restore it only once the row is
 * genuinely wider than that again.
 */
export function OverflowRow({
  overflowLabel = "More tools",
  className,
  children,
}: OverflowRowProps): ReactNode {
  const items = Children.toArray(children);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [measuredItemCount, setMeasuredItemCount] = useState(items.length);

  /**
   * The container width at which item `i` was removed, alongside the item count
   * those widths were measured against. Restoring an item only when the row is
   * wider than its recorded width is what stops it flickering between two
   * states at a boundary width.
   */
  const removals = useRef<{ count: number; widths: number[] }>({
    count: items.length,
    widths: [],
  });

  // Adding or removing a group means starting over — every recorded width was
  // measured against a different set of items. Adjusting state *during render*
  // is React's documented way to reset on a changed prop; doing it in an effect
  // would commit the stale layout first and then re-render over it.
  if (measuredItemCount !== items.length) {
    setMeasuredItemCount(items.length);
    setVisibleCount(items.length);
  }

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const { scrollWidth, clientWidth } = container;
    // jsdom reports every element as zero-sized. Measuring there would collapse
    // the row to nothing, so it is left alone — and a test asserting overflow
    // behaviour has to run in a real browser anyway.
    if (clientWidth === 0) {
      return;
    }

    // Discard widths measured against a different set of items.
    if (removals.current.count !== items.length) {
      removals.current = { count: items.length, widths: [] };
    }

    setVisibleCount((count) => {
      if (scrollWidth > clientWidth && count > 0) {
        removals.current.widths[count - 1] = clientWidth;
        return count - 1;
      }
      const restoreAt = removals.current.widths[count];
      if (count < items.length && restoreAt !== undefined && clientWidth > restoreAt) {
        return count + 1;
      }
      return count;
    });
  }, [items.length]);

  // A layout effect, so a too-wide row is corrected before it is painted.
  useLayoutEffect(measure);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [measure]);

  const visible = items.slice(0, visibleCount);
  const overflowed = items.slice(visibleCount);

  return (
    <div ref={containerRef} className={cn("de-overflow-row", className)}>
      {visible}

      {overflowed.length > 0 && (
        <Popover
          label={overflowLabel}
          placement="bottom-end"
          trigger={
            <button
              type="button"
              className="de-button de-button--ghost de-button--icon de-overflow-row__trigger"
              aria-label={overflowLabel}
            >
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13" cy="8" r="1.5" />
              </svg>
            </button>
          }
        >
          <div className="de-overflow-row__panel">{overflowed}</div>
        </Popover>
      )}
    </div>
  );
}
