/**
 * Page layout primitives — the framework-agnostic single source of truth for
 * page dimensions, orientation, and margins. Consumed by the print exporter
 * (`serialization/print.ts`) and by framework adapters' page UI (e.g. the React
 * `PageLayoutProvider`). Pure data + helpers; no engine, DOM, or UI dependency.
 *
 * Page layout is *presentation*, not document content: it describes how a
 * document is displayed and printed, not what it contains. It is therefore kept
 * out of the document model (a future revision may persist it as document
 * metadata, but that is deliberately not the case today).
 */

/** The length unit a {@link PageSize}/{@link PageMargins} is expressed in. */
export type LengthUnit = "mm" | "in";

/** A named physical page size, in its natural unit. */
export interface PageSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly unit: LengthUnit;
}

/**
 * The standard page sizes, in portrait orientation. ISO A-series in millimetres,
 * North American sizes in inches — each in the unit the size is defined in, so
 * the numbers match what users recognize.
 */
export const PAGE_SIZES = {
  A3: { name: "A3", width: 297, height: 420, unit: "mm" },
  A4: { name: "A4", width: 210, height: 297, unit: "mm" },
  A5: { name: "A5", width: 148, height: 210, unit: "mm" },
  Letter: { name: "Letter", width: 8.5, height: 11, unit: "in" },
  Legal: { name: "Legal", width: 8.5, height: 14, unit: "in" },
  Tabloid: { name: "Tabloid", width: 11, height: 17, unit: "in" },
  Executive: { name: "Executive", width: 7.25, height: 10.5, unit: "in" },
} as const satisfies Record<string, PageSize>;

/** The name of a size in {@link PAGE_SIZES} (e.g. `"A4"`, `"Letter"`). */
export type PageSizeName = keyof typeof PAGE_SIZES;

/** Page orientation. `"landscape"` swaps width and height. */
export type PageOrientation = "portrait" | "landscape";

/** Page margins, one value per side, in a shared unit. */
export interface PageMargins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly unit: LengthUnit;
}

/** Common margin presets (Word/Docs-style), in inches. */
export const MARGIN_PRESETS = {
  normal: { top: 1, right: 1, bottom: 1, left: 1, unit: "in" },
  narrow: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5, unit: "in" },
  moderate: { top: 1, right: 0.75, bottom: 1, left: 0.75, unit: "in" },
  wide: { top: 1, right: 2, bottom: 1, left: 2, unit: "in" },
} as const satisfies Record<string, PageMargins>;

/** The name of a preset in {@link MARGIN_PRESETS}. */
export type MarginPresetName = keyof typeof MARGIN_PRESETS;

/**
 * A complete page layout: size, orientation, margins, and optional running
 * header/footer text and page numbering. This is the value a framework adapter
 * holds as view state and passes to the print exporter.
 */
export interface PageLayout {
  readonly size: PageSizeName;
  readonly orientation: PageOrientation;
  readonly margins: PageMargins;
  /** Running header text shown at the top of every page. */
  readonly header?: string;
  /** Running footer text shown at the bottom of every page. */
  readonly footer?: string;
  /** Whether to show page numbers (in the footer). */
  readonly showPageNumbers?: boolean;
}

/** The default layout: A4 portrait with normal margins, no header/footer. */
export const defaultPageLayout: PageLayout = {
  size: "A4",
  orientation: "portrait",
  margins: MARGIN_PRESETS.normal,
  showPageNumbers: false,
};

/** A page's outer dimensions after orientation is applied. */
export interface ResolvedPageDimensions {
  readonly width: number;
  readonly height: number;
  readonly unit: LengthUnit;
}

/**
 * The page's outer width/height for a size + orientation — landscape swaps the
 * portrait width and height.
 */
export function resolvePageDimensions(
  size: PageSizeName,
  orientation: PageOrientation,
): ResolvedPageDimensions {
  const base = PAGE_SIZES[size];
  if (orientation === "landscape") {
    return { width: base.height, height: base.width, unit: base.unit };
  }
  return { width: base.width, height: base.height, unit: base.unit };
}

/** Formats a length with its unit as a CSS dimension string, e.g. `toCssLength(210, "mm") === "210mm"`. */
export function toCssLength(value: number, unit: LengthUnit): string {
  return `${value}${unit}`;
}

/** Formats margins as a CSS `margin` shorthand (`top right bottom left`). */
export function marginsToCss(margins: PageMargins): string {
  return [margins.top, margins.right, margins.bottom, margins.left]
    .map((value) => toCssLength(value, margins.unit))
    .join(" ");
}
