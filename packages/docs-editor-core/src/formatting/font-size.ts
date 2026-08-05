/**
 * Font size (ROADMAP Phase 9, Milestone 9.2).
 *
 * Sizes are stored in **points**, not pixels. This is a document editor: page
 * layout is already in physical units, DOCX stores half-points so the
 * round-trip is exact rather than rounded, and the number in the toolbar
 * matches what Word and Google Docs show for the same document. A pixel model
 * would be web-native and wrong everywhere the document leaves the browser.
 *
 * `setMark` is imported by module path rather than through `../commands`, which
 * re-exports this module — a barrel import would make the two mutually
 * dependent.
 */

import { setMark } from "../commands/built-ins";
import { activeMarks } from "../queries";

import type { Dispatch } from "../commands";
import type { MarkSpec } from "../schema";
import type { EditorState } from "../state";

/** The attribute the font-size mark carries. */
export const FONT_SIZE_ATTR = "size";

/** The mark name these commands operate on by default. */
export const FONT_SIZE_MARK = "font_size";

/**
 * The body size in points, used when no `font_size` mark applies.
 *
 * 12pt is exactly 16px, which is what the shipped stylesheet already rendered
 * body text at — so adopting points changed the unit without changing how any
 * existing document looks. (Word and Google Docs default to 11pt; matching the
 * current appearance mattered more than matching their number.)
 */
export const DEFAULT_FONT_SIZE = 12;

/** Smallest and largest sizes {@link setFontSize} accepts, in points. */
export const MIN_FONT_SIZE = 1;
export const MAX_FONT_SIZE = 400;

/**
 * The sizes a size dropdown offers, in points — the Word/Google Docs ladder.
 *
 * Presets are a convenience, not a constraint: {@link setFontSize} accepts any
 * value in range, so a typed 13 works even though it is not listed.
 */
export const FONT_SIZE_PRESETS: readonly number[] = [
  8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72,
];

/** Whether `value` is a font size this schema will accept. */
export function isFontSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_FONT_SIZE &&
    value <= MAX_FONT_SIZE
  );
}

/**
 * The font size in effect for the selection, in points.
 *
 * Falls back to {@link DEFAULT_FONT_SIZE} when no mark applies, so a stepper
 * always has a number to increment — reporting `null` would leave the first
 * press of "+" with nothing to add to.
 *
 * A selection spanning two sizes reports the default rather than either of
 * them: {@link import("../queries").activeMarks} only returns marks covering
 * the *whole* selection, so a mixed range legitimately has no single size.
 */
export function activeFontSize<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  options: FontSizeOptions = {},
): number {
  const markName = options.markName ?? FONT_SIZE_MARK;
  const mark = activeMarks(state).find((entry) => entry.type === markName);
  const size = mark?.attrs[FONT_SIZE_ATTR];
  return isFontSize(size) ? size : (options.defaultSize ?? DEFAULT_FONT_SIZE);
}

export interface FontSizeOptions {
  /** Mark name to operate on. Defaults to {@link FONT_SIZE_MARK}. */
  readonly markName?: string;
  /** Size to treat as the body default. Defaults to {@link DEFAULT_FONT_SIZE}. */
  readonly defaultSize?: number;
}

/**
 * Sets the font size over the selection, in points.
 *
 * At a collapsed cursor this updates the stored marks, so the next typed
 * character carries the size — which is what makes choosing a size before
 * typing work.
 */
export function setFontSize(points: number, options: FontSizeOptions = {}) {
  if (!isFontSize(points)) {
    // A programmer error rather than user input: a size the schema would reject
    // should fail at the call site, not silently write an unrenderable value.
    throw new TypeError(
      `Invalid font size "${String(points)}". Expected ${String(MIN_FONT_SIZE)}–${String(MAX_FONT_SIZE)} points.`,
    );
  }
  const markName = options.markName ?? FONT_SIZE_MARK;

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => setMark(markName, { [FONT_SIZE_ATTR]: points })(state, dispatch);
}

/**
 * Steps the font size by `delta` points — what the `−`/`+` buttons of a size
 * stepper run.
 *
 * Clamped rather than declining at the bounds, and reports `false` only when
 * the size would not actually change, so the button disables itself at the
 * ends instead of appearing live and doing nothing.
 */
export function adjustFontSize(delta: number, options: FontSizeOptions = {}) {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new TypeError(`Invalid font size delta "${String(delta)}". Expected a non-zero number.`);
  }

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const current = activeFontSize(state, options);
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(current + delta)));
    if (next === current) {
      return false;
    }
    return setFontSize(next, options)(state, dispatch);
  };
}

/**
 * The font-size mark's spec.
 *
 * No `excludes`: a size composes with bold, colour and everything else, which
 * is exactly what a mark carrying a *value* rather than a state should do.
 */
export function fontSizeMarkSpec(): MarkSpec {
  return { attrs: { [FONT_SIZE_ATTR]: { default: DEFAULT_FONT_SIZE } } };
}

/** The inline `style` a font-size mark renders to. */
export function fontSizeStyle(attrs: Readonly<Record<string, unknown>>): string {
  const size = attrs[FONT_SIZE_ATTR];
  return `font-size: ${String(isFontSize(size) ? size : DEFAULT_FONT_SIZE)}pt`;
}

/**
 * Reads a CSS `font-size` back as points, or `null` when it is not an absolute
 * length.
 *
 * Relative units (`em`, `%`, `larger`) are declined rather than guessed at:
 * their value depends on an inherited size this parser does not have, and
 * inventing one would silently resize imported text.
 */
export function parseFontSize(value: string): number | null {
  const match = /^\s*([\d.]+)\s*(pt|px|in|cm|mm|pc)\s*$/i.exec(value);
  const amount = Number.parseFloat(match?.[1] ?? "");
  if (!Number.isFinite(amount)) {
    return null;
  }
  const unit = (match?.[2] ?? "").toLowerCase();
  const perUnit: Record<string, number> = {
    pt: 1,
    px: 0.75, // 96px = 72pt
    in: 72,
    cm: 72 / 2.54,
    mm: 72 / 25.4,
    pc: 12,
  };
  const points = amount * (perUnit[unit] ?? 0);
  // Rounded to whole points: the model and the toolbar both deal in integers,
  // and an imported 11.04pt is 11pt for every purpose a user has.
  const rounded = Math.round(points);
  return isFontSize(rounded) ? rounded : null;
}
