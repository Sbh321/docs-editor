import { marginsToCss, toCssLength } from "@sbh321/docs-editor-core";

import { useThemeClassName } from "../theme/use-theme";

import { usePageLayout } from "./use-page-layout";
import { PAGE_GAP_PX, usePagination } from "./use-pagination";

import type { LengthUnit, PageLayout } from "@sbh321/docs-editor-core";
import type { CSSProperties, ReactNode } from "react";

export interface PageSurfaceProps {
  /** The editor (and anything else) rendered inside the page's content area. */
  readonly children?: ReactNode;
  /** Class for the outer canvas (the area around the page). */
  readonly className?: string;
  readonly style?: CSSProperties;
  /**
   * Enable live pagination: content flows onto multiple page sheets as it grows,
   * with gaps between them and a running header/footer on each. Off by default
   * (a single continuous sheet). See {@link usePagination}.
   */
  readonly paginate?: boolean;
}

const PX_PER_IN = 96;

function toPx(value: number, unit: LengthUnit): number {
  return unit === "in" ? value * PX_PER_IN : (value * PX_PER_IN) / 25.4;
}

function cx(...names: (string | undefined)[]): string | undefined {
  return names.filter(Boolean).join(" ") || undefined;
}

function footerText(layout: PageLayout, pageNumber: number): string {
  return [layout.footer, layout.showPageNumbers ? `Page ${pageNumber}` : undefined]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

/**
 * Renders the editor inside a correctly-sized "page" of the current
 * {@link usePageLayout} size/orientation, with margins applied and the running
 * header/footer in the top/bottom margins.
 *
 * With `paginate`, content flows across multiple sheets (drawn as a backdrop
 * with gaps) while the editor stays a single contenteditable — page breaks are
 * visual spacing, not document edits (see {@link usePagination}). Without it, a
 * single continuous sheet.
 *
 * Structural sizing/positioning is inline (computed, must not be themed away);
 * the *look* (page background, shadow, canvas color) comes from the
 * `pageCanvas`/`page`/`pageHeader`/`pageFooter` theme classes.
 */
export function PageSurface(props: PageSurfaceProps): ReactNode {
  const { layout, dimensions } = usePageLayout();
  const { pageCount } = usePagination(props.paginate ?? false);

  const canvasClassName = useThemeClassName("pageCanvas");
  const pageClassName = useThemeClassName("page");
  const headerClassName = useThemeClassName("pageHeader");
  const footerClassName = useThemeClassName("pageFooter");

  const { margins } = layout;
  const topInset = toCssLength(margins.top, margins.unit);
  const bottomInset = toCssLength(margins.bottom, margins.unit);
  const leftInset = toCssLength(margins.left, margins.unit);
  const rightInset = toCssLength(margins.right, margins.unit);

  const marginBoxStyle: CSSProperties = {
    position: "absolute",
    left: leftInset,
    right: rightInset,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  const renderHeaderFooter = (pageNumber: number) => (
    <>
      {layout.header ? (
        <div className={headerClassName} style={{ ...marginBoxStyle, top: 0, height: topInset }}>
          {layout.header}
        </div>
      ) : null}
      {footerText(layout, pageNumber) ? (
        <div
          className={footerClassName}
          style={{ ...marginBoxStyle, bottom: 0, height: bottomInset }}
        >
          {footerText(layout, pageNumber)}
        </div>
      ) : null}
    </>
  );

  // Single continuous sheet.
  if (!props.paginate) {
    return (
      <div className={cx(canvasClassName, props.className)} style={props.style}>
        <div
          className={pageClassName}
          style={{
            width: toCssLength(dimensions.width, dimensions.unit),
            minHeight: toCssLength(dimensions.height, dimensions.unit),
            padding: marginsToCss(margins),
            position: "relative",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {renderHeaderFooter(1)}
          {props.children}
        </div>
      </div>
    );
  }

  // Paginated: a backdrop of sheets (with gaps), and the editor as one content
  // column overlaid — pagination spacing aligns each block onto its sheet.
  const pageWidthPx = toPx(dimensions.width, dimensions.unit);
  const pageHeightPx = toPx(dimensions.height, dimensions.unit);
  const topPx = toPx(margins.top, margins.unit);
  const bottomPx = toPx(margins.bottom, margins.unit);
  const leftPx = toPx(margins.left, margins.unit);
  const rightPx = toPx(margins.right, margins.unit);
  const pageContentPx = Math.max(1, pageHeightPx - topPx - bottomPx);
  const stackHeightPx = pageCount * pageHeightPx + (pageCount - 1) * PAGE_GAP_PX;

  return (
    <div className={cx(canvasClassName, props.className)} style={props.style}>
      <div style={{ position: "relative", width: pageWidthPx, height: stackHeightPx }}>
        {Array.from({ length: pageCount }, (_, index) => (
          <div
            key={index}
            className={pageClassName}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: index * (pageHeightPx + PAGE_GAP_PX),
              left: 0,
              width: pageWidthPx,
              height: pageHeightPx,
              boxSizing: "border-box",
            }}
          >
            {renderHeaderFooter(index + 1)}
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            top: topPx,
            left: leftPx,
            width: pageWidthPx - leftPx - rightPx,
            // Fill at least the first page's content area so a click anywhere on
            // the page places the caret (the editor stretches via flex).
            minHeight: pageContentPx,
            display: "flex",
            flexDirection: "column",
            zIndex: 1,
          }}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}
