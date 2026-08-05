/**
 * How HTML maps back into {@link defaultSchema} (ROADMAP Phase 8,
 * Milestone 8.1).
 *
 * This drives HTML import, DOCX import (mammoth emits ordinary HTML), and
 * **paste from another application** — which is the case that matters most,
 * because it is the one where the markup is hostile. Sanitization happens in
 * the importer; these rules decide what the surviving markup *means*.
 *
 * Shipped alongside the renderers so import and export stay inverses of each
 * other. A consumer maintaining both by hand ends up with markup they can emit
 * but not read back.
 */

import { isSafeLinkUrl, parseFontSize, parseParagraphFormatting } from "../formatting";
import { parseListStyle, taskListHtmlParseRules } from "../lists";
import { mediaHtmlParseRules } from "../media";

import type { HtmlParseSpec, MarkParseRule, NodeParseRule } from "../dom-parse-spec";
import type { DefaultMarkName, DefaultNodeName } from "./default-schema";

/** Extracts a CSS declaration's value from an element's inline `style`. */
function styleValue(element: Element, property: string): string | null {
  const style = element.getAttribute("style");
  if (!style) {
    return null;
  }
  // Anchored to a declaration boundary so `color` does not match inside
  // `background-color`.
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(style);
  return match?.[1] ? match[1].trim() : null;
}

const headingRules: readonly NodeParseRule<DefaultNodeName>[] = ([1, 2, 3, 4, 5, 6] as const).map(
  (level) => ({
    tag: `h${String(level)}`,
    node: "heading" as const,
    getAttrs: (element) => ({ level, ...parseParagraphFormatting(element) }),
  }),
);

/** Node parse rules for {@link defaultSchema}. */
export const defaultNodeParseRules: readonly NodeParseRule<DefaultNodeName>[] = [
  { tag: "p", node: "paragraph", getAttrs: (element) => parseParagraphFormatting(element) },
  ...headingRules,
  { tag: "blockquote", node: "blockquote" },
  // Task lists first: a checklist is a `ul` too, and the first matching rule
  // wins — behind the plain rules these would never be reached.
  ...taskListHtmlParseRules<DefaultNodeName>(),

  { tag: "ul", node: "bullet_list", getAttrs: (element) => parseListStyle(element) },
  {
    tag: "ol",
    node: "ordered_list",
    getAttrs: (element) => {
      const start = Number.parseInt(element.getAttribute("start") ?? "", 10);
      return {
        ...(Number.isFinite(start) && start > 0 ? { order: start } : {}),
        ...parseListStyle(element),
      };
    },
  },
  { tag: "li", node: "list_item" },
  { tag: "hr", node: "divider" },
  { tag: "pre", node: "code_block", getAttrs: (element) => parseParagraphFormatting(element) },

  // Media parsing ships with the core because it is security-relevant: sources
  // are checked on the way in, and re-implementing that per application is how
  // a `javascript:` URL eventually gets through.
  ...(mediaHtmlParseRules<DefaultNodeName, DefaultMarkName>().nodes ?? []),

  { tag: "table", node: "table" },
  { tag: "tr", node: "table_row" },
  {
    tag: "td",
    node: "table_cell",
    getAttrs: (element) => ({
      colspan: Number.parseInt(element.getAttribute("colspan") ?? "1", 10) || 1,
      rowspan: Number.parseInt(element.getAttribute("rowspan") ?? "1", 10) || 1,
    }),
  },
  {
    tag: "th",
    node: "table_header",
    getAttrs: (element) => ({
      colspan: Number.parseInt(element.getAttribute("colspan") ?? "1", 10) || 1,
      rowspan: Number.parseInt(element.getAttribute("rowspan") ?? "1", 10) || 1,
    }),
  },
];

/** Mark parse rules for {@link defaultSchema}. */
export const defaultMarkParseRules: readonly MarkParseRule<DefaultMarkName>[] = [
  // Both the semantic and the presentational tag, since pasted markup uses
  // whichever the source application happened to emit.
  { tag: "strong", mark: "bold" },
  { tag: "b", mark: "bold" },
  { tag: "em", mark: "italic" },
  { tag: "i", mark: "italic" },
  { tag: "u", mark: "underline" },
  { tag: "s", mark: "strikethrough" },
  { tag: "del", mark: "strikethrough" },
  { tag: "strike", mark: "strikethrough" },
  { tag: "code", mark: "code" },
  {
    tag: "a",
    mark: "link",
    getAttrs: (element) => {
      const href = element.getAttribute("href") ?? "";
      // An unsafe href declines the whole mark rather than importing as an
      // empty link: pasted markup is the hostile case, and a `javascript:`
      // anchor should lose its link, not keep one pointing nowhere.
      if (!isSafeLinkUrl(href)) {
        return null;
      }
      const title = element.getAttribute("title");
      const target = element.getAttribute("target");
      return { href, title: title ?? null, target: target ?? null };
    },
  },
  {
    tag: "mark",
    mark: "highlight",
    getAttrs: (element) => {
      const color = styleValue(element, "background-color");
      return color ? { color } : {};
    },
  },
  // A bare `<span>` carries no meaning, so these decline (`null`) unless the
  // span actually declares the property they are about. Without that, every
  // pasted span would become a font or colour mark.
  {
    tag: "span",
    mark: "font_family",
    getAttrs: (element) => {
      const family = styleValue(element, "font-family");
      return family ? { family } : null;
    },
  },
  {
    tag: "span",
    mark: "text_color",
    getAttrs: (element) => {
      const color = styleValue(element, "color");
      return color ? { color } : null;
    },
  },
  {
    tag: "span",
    mark: "font_size",
    getAttrs: (element) => {
      const raw = styleValue(element, "font-size");
      const size = raw === null ? null : parseFontSize(raw);
      return size === null ? null : { size };
    },
  },
];

/**
 * The complete HTML parse spec for {@link defaultSchema} — the inverse of
 * {@link defaultNodeRenderers} and {@link defaultMarkRenderers}.
 */
export const defaultParseSpec: HtmlParseSpec<DefaultNodeName, DefaultMarkName> = {
  nodes: defaultNodeParseRules,
  marks: defaultMarkParseRules,
};
