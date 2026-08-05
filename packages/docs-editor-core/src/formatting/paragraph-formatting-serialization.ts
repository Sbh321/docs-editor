/**
 * How paragraph formatting crosses the HTML boundary (ROADMAP Phase 9,
 * Milestone 9.1).
 *
 * Export and import live in one module so they stay inverses. Keeping them
 * apart is how a document ends up with formatting that renders, exports, and
 * then imports back as nothing.
 */

import { isTextAlign, MAX_INDENT, PARAGRAPH_FORMATTING_ATTRS } from "./paragraph-formatting";

/**
 * Width of one indent level, in points. 36pt is half an inch — Word's and
 * Google Docs' default tab stop, so a document indented here lands on the same
 * grid when opened there.
 */
export const INDENT_STEP_POINTS = 36;

/**
 * The inline `style` for a block's alignment and indentation, or `undefined`
 * when it carries neither.
 *
 * Indentation is emitted as `margin-inline-start`, not `margin-left`: the
 * logical property follows the writing direction, so an indented paragraph in a
 * right-to-left document indents from the right, where its text begins. Using
 * `margin-left` would indent it from the wrong edge — the same reason `align`
 * defaults to `null` rather than `"left"`.
 */
export function paragraphFormattingStyle(
  attrs: Readonly<Record<string, unknown>>,
): string | undefined {
  const declarations: string[] = [];

  const align = attrs[PARAGRAPH_FORMATTING_ATTRS.align];
  if (isTextAlign(align)) {
    declarations.push(`text-align: ${align}`);
  }

  const indent = attrs[PARAGRAPH_FORMATTING_ATTRS.indent];
  if (typeof indent === "number" && Number.isFinite(indent) && indent > 0) {
    const level = Math.min(MAX_INDENT, Math.round(indent));
    declarations.push(`margin-inline-start: ${String(level * INDENT_STEP_POINTS)}pt`);
  }

  return declarations.length > 0 ? declarations.join("; ") : undefined;
}

/**
 * Reads alignment and indentation back out of an element.
 *
 * Returns only the attributes it can actually find, so the result spreads onto
 * a parse rule's other attributes without overwriting them with defaults.
 *
 * Both the modern `margin-inline-start` and the physical `margin-left` are
 * read, because the markup being imported is usually not ours: Word and Google
 * Docs both emit `margin-left`, and the `align` attribute on `<p>` still
 * appears in older HTML.
 */
export function parseParagraphFormatting(element: Element): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  const align = readAlign(element);
  if (align !== null) {
    attrs[PARAGRAPH_FORMATTING_ATTRS.align] = align;
  }

  const indent = readIndent(element);
  if (indent !== null) {
    attrs[PARAGRAPH_FORMATTING_ATTRS.indent] = indent;
  }

  return attrs;
}

function readAlign(element: Element): string | null {
  const styled = styleValue(element, "text-align");
  if (isTextAlign(styled)) {
    return styled;
  }
  // The legacy presentational attribute, still emitted by older exporters.
  const attribute = element.getAttribute("align");
  return isTextAlign(attribute) ? attribute : null;
}

/**
 * Converts a CSS margin back to an indent *level*, since the model stores
 * levels rather than a length.
 *
 * Anything that does not divide cleanly still rounds to the nearest level
 * rather than being dropped: an imported document indented by 40pt is much
 * better represented as one level than as none.
 */
function readIndent(element: Element): number | null {
  const raw = styleValue(element, "margin-inline-start") ?? styleValue(element, "margin-left");
  if (raw === null) {
    return null;
  }
  const points = toPoints(raw);
  if (points === null || points <= 0) {
    return null;
  }
  return Math.min(MAX_INDENT, Math.max(1, Math.round(points / INDENT_STEP_POINTS)));
}

/** CSS absolute length units, as multiples of a point. */
const POINTS_PER_UNIT: Readonly<Record<string, number>> = {
  pt: 1,
  px: 0.75, // 96px = 72pt
  in: 72,
  cm: 72 / 2.54,
  mm: 72 / 25.4,
  pc: 12,
  // Relative to the font rather than the page, so this assumes the 12pt body
  // default the preset ships. An imported `2em` indent is approximate either
  // way; approximating it beats discarding it.
  em: 12,
  rem: 12,
};

function toPoints(value: string): number | null {
  const match = /^\s*(-?[\d.]+)\s*([a-z%]*)\s*$/i.exec(value);
  const amount = Number.parseFloat(match?.[1] ?? "");
  if (!Number.isFinite(amount)) {
    return null;
  }
  const unit = (match?.[2] ?? "").toLowerCase();
  // A unitless zero is legal CSS; any other unitless length is not, and a
  // percentage has no fixed point value, so both decline.
  if (unit === "") {
    return amount === 0 ? 0 : null;
  }
  const perUnit = POINTS_PER_UNIT[unit];
  return perUnit === undefined ? null : amount * perUnit;
}

/** Extracts one CSS declaration's value from an element's inline `style`. */
function styleValue(element: Element, property: string): string | null {
  const style = element.getAttribute("style");
  if (!style) {
    return null;
  }
  // Anchored to a declaration boundary so `margin-left` does not match inside
  // `scroll-margin-left`.
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(style);
  return match?.[1] ? match[1].trim() : null;
}
