/**
 * How {@link defaultSchema}'s types render to HTML (ROADMAP Phase 8,
 * Milestone 8.1).
 *
 * One set of renderers drives **everything** that produces markup: the live
 * view, HTML export, and print. That is the point of shipping them together —
 * a consumer maintaining separate maps for screen and export inevitably lets
 * the two drift, and the drift only shows up in a printed document.
 */

import { fontSizeStyle, linkAttributes, paragraphFormattingStyle } from "../formatting";
import { listStyleAttributes, taskListNodeRenderers } from "../lists";
import { mediaNodeRenderers } from "../media";

import { DEFAULT_HIGHLIGHT_COLOR, DEFAULT_TEXT_COLOR, DEFAULT_FONT_FAMILY } from "./default-schema";

import type { DOMOutputSpec, MarkRenderer, NodeRenderer } from "../dom-output-spec";
import type { MediaRendererOptions } from "../media";
import type { DefaultMarkName, DefaultNodeName } from "./default-schema";

/** Reads a string attribute, since node and mark attributes are typed as `unknown`. */
function attrString(attrs: Record<string, unknown>, name: string, fallback: string): string {
  const value = attrs[name];
  return typeof value === "string" && value !== "" ? value : fallback;
}

/** Reads a positive integer attribute, clamped into `[min, max]`. */
function attrInteger(
  attrs: Record<string, unknown>,
  name: string,
  min: number,
  max: number,
): number {
  const value = attrs[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Builds an element spec carrying a block's alignment and indentation, if any.
 *
 * The `style` attribute is omitted entirely for an unformatted block rather
 * than emitted empty, so exported HTML for a plain document stays clean and
 * round-trips byte-for-byte.
 */
function withFormatting(
  tag: string,
  attrs: Readonly<Record<string, unknown>>,
  content: DOMOutputSpec | 0,
): DOMOutputSpec {
  const style = paragraphFormattingStyle(attrs);
  return style === undefined ? [tag, content] : [tag, { style }, content];
}

/**
 * Node renderers for {@link defaultSchema}.
 *
 * `options` is forwarded to the media renderers — pass `{ loading: "eager" }`
 * when building output for print, since a lazy image that never entered the
 * viewport may not be fetched in time and a missing image in a PDF is a
 * permanent, silent loss.
 */
export function defaultNodeRenderers(
  options: MediaRendererOptions = {},
): NodeRenderer<DefaultNodeName> {
  return {
    paragraph: (node) => withFormatting("p", node.attrs, 0),
    // Clamped rather than trusted: an out-of-range level would emit an element
    // like `<h9>`, which is not HTML.
    heading: (node) =>
      withFormatting(`h${String(attrInteger(node.attrs, "level", 1, 6))}`, node.attrs, 0),
    blockquote: () => ["blockquote", 0],
    bullet_list: (node) => ["ul", listStyleAttributes(node.attrs), 0],
    ordered_list: (node) => [
      "ol",
      {
        start: String(attrInteger(node.attrs, "order", 1, 1e6)),
        ...listStyleAttributes(node.attrs),
      },
      0,
    ],
    list_item: () => ["li", 0],

    ...taskListNodeRenderers<DefaultNodeName>(),
    divider: () => ["hr"],
    // `<pre><code>` is the semantic pairing every Markdown and HTML consumer
    // expects; the content hole goes in the inner element.
    code_block: (node) => withFormatting("pre", node.attrs, ["code", 0]),

    ...mediaNodeRenderers<DefaultNodeName>(options),

    // `<tbody>` is emitted explicitly. A browser inserts one anyway when
    // parsing, so exported HTML that omits it would not round-trip byte-for-byte
    // through an import.
    table: () => ["table", ["tbody", 0]],
    table_row: () => ["tr", 0],
    table_cell: (node) => [
      "td",
      {
        colspan: String(attrInteger(node.attrs, "colspan", 1, 1000)),
        rowspan: String(attrInteger(node.attrs, "rowspan", 1, 1000)),
      },
      0,
    ],
    table_header: (node) => [
      "th",
      {
        colspan: String(attrInteger(node.attrs, "colspan", 1, 1000)),
        rowspan: String(attrInteger(node.attrs, "rowspan", 1, 1000)),
      },
      0,
    ],
  };
}

/**
 * Mark renderers for {@link defaultSchema}.
 *
 * Colour and font are emitted as inline `style`, not classes: they are values
 * chosen per-run by the author, so there is no stable class to name, and inline
 * styles are what survives a copy into another application.
 */
export const defaultMarkRenderers: MarkRenderer<DefaultMarkName> = {
  bold: () => ["strong", 0],
  italic: () => ["em", 0],
  underline: () => ["u", 0],
  strikethrough: () => ["s", 0],
  code: () => ["code", 0],
  // Sanitized here, not merely at input: a document can acquire an unsafe URL
  // through an import, a paste, or being built programmatically, so the last
  // step before markup is the one that has to check. `rel="noopener"` is
  // derived for `target="_blank"` rather than stored, so an imported link that
  // omitted it still gets it.
  link: (mark): DOMOutputSpec => ["a", linkAttributes(mark.attrs), 0],
  highlight: (mark): DOMOutputSpec => [
    "mark",
    { style: `background-color: ${attrString(mark.attrs, "color", DEFAULT_HIGHLIGHT_COLOR)}` },
    0,
  ],
  text_color: (mark): DOMOutputSpec => [
    "span",
    { style: `color: ${attrString(mark.attrs, "color", DEFAULT_TEXT_COLOR)}` },
    0,
  ],
  font_family: (mark): DOMOutputSpec => [
    "span",
    { style: `font-family: ${attrString(mark.attrs, "family", DEFAULT_FONT_FAMILY)}` },
    0,
  ],
  font_size: (mark): DOMOutputSpec => ["span", { style: fontSizeStyle(mark.attrs) }, 0],
};
