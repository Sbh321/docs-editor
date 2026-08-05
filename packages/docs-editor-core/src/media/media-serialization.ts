/**
 * Media rendering and parsing (ROADMAP Phase 7 — Media, Milestone 7.6).
 *
 * Every consumer needs the same `<img>`/`<video>`/`<audio>` mapping in both
 * directions, and the parsing half is security-relevant — so it ships here
 * rather than being rewritten (and mis-written) in each application. The
 * renderers drive HTML export and print; the parse rules drive HTML import and
 * external paste.
 *
 * These are ordinary `NodeRenderer`/`HtmlParseSpec` values, so a consumer can
 * spread them and override any single entry.
 */

import { isSafeMediaUrl } from "./media-ingest";
import { isMediaAlignment, MEDIA_ATTRS } from "./media-types";

import type { MediaSchemaNodeName } from "./media-node-specs";
import type { DOMOutputSpec, NodeRenderer } from "../dom-output-spec";
import type { HtmlParseSpec, NodeParseRule } from "../dom-parse-spec";
import type { DocumentNode } from "../schema";

/** Reads a string attribute; node attributes are typed as `unknown`. */
function attrString(node: DocumentNode, name: string): string {
  const value = node.attrs[name];
  return typeof value === "string" ? value : "";
}

/** Reads a numeric attribute as a string, or `undefined` when unset. */
function attrDimension(node: DocumentNode, name: string): string | undefined {
  const value = node.attrs[name];
  return typeof value === "number" ? String(value) : undefined;
}

/**
 * Drops entries whose value is `undefined`, which `DOMOutputSpec` cannot carry.
 *
 * Empty strings are **kept**: `alt=""` is how an image is marked decorative for
 * assistive technology, and `controls=""` is how a boolean HTML attribute is
 * written. Callers pass `undefined` for "omit this attribute".
 */
function definedAttrs(attrs: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Attributes shared by every rendered media element.
 *
 * Alignment is emitted as `data-align` rather than a class or inline style: it
 * is document *meaning*, and leaving the visual treatment to the consumer's CSS
 * keeps the exported HTML themeable instead of baking one look into it.
 */
function commonAttrs(node: DocumentNode): Record<string, string | undefined> {
  return {
    width: attrDimension(node, MEDIA_ATTRS.width),
    height: attrDimension(node, MEDIA_ATTRS.height),
    title: attrString(node, MEDIA_ATTRS.title) || undefined,
    "data-align": attrString(node, MEDIA_ATTRS.align) || undefined,
  };
}

/**
 * A media node's `src`, blanked when it is not safe to emit.
 *
 * Export sanitizes as well as import: a document may have been built
 * programmatically, or loaded from storage that predates the importer's checks,
 * and neither should be able to put `javascript:` into exported markup.
 */
function safeSrc(node: DocumentNode): string | undefined {
  const src = attrString(node, MEDIA_ATTRS.src);
  return src && isSafeMediaUrl(src) ? src : undefined;
}

/**
 * Loading behaviour for rendered media (ROADMAP Phase 7, Milestone 7.7).
 *
 * These are *rendering* hints, not document data, so they live here rather than
 * as node attributes — the same document should be able to render lazily on
 * screen and eagerly for print.
 */
export interface MediaRendererOptions {
  /**
   * `loading` on images and embeds. Defaults to `"lazy"`, so a document with
   * hundreds of images does not fetch and decode all of them at once.
   *
   * **Pass `"eager"` when exporting for print.** A lazy image that has not
   * entered the viewport may not be fetched in time for printing, and a missing
   * image in a PDF is a silent, permanent loss rather than a slow scroll.
   */
  readonly loading?: "lazy" | "eager";
  /**
   * `preload` on video and audio. Defaults to `"metadata"` — enough to know the
   * duration and size a player needs to reserve space, without streaming the
   * media itself. `"none"` for the lightest possible long document; `"auto"`
   * only when playback is the point of the page.
   */
  readonly preload?: "none" | "metadata" | "auto";
  /**
   * `decoding` on images. Defaults to `"async"`, keeping image decode off the
   * path that would otherwise block the first paint of the text around it.
   */
  readonly decoding?: "async" | "sync" | "auto";
}

/**
 * Renderers for the media node types.
 *
 * Generic over the consuming schema's node names, since a real schema declares
 * paragraphs and headings alongside media. The renderers themselves read only
 * attributes, so they are node-type agnostic.
 *
 * ```ts
 * const nodeRenderers = {
 *   ...mediaNodeRenderers<MyNodeName>(),
 *   paragraph: () => ["p", 0],
 * };
 *
 * // For print, load everything up front — see `MediaRendererOptions.loading`.
 * const printRenderers = mediaNodeRenderers<MyNodeName>({ loading: "eager" });
 * ```
 */
export function mediaNodeRenderers<NodeName extends string = MediaSchemaNodeName>(
  options: MediaRendererOptions = {},
): NodeRenderer<NodeName> {
  const { loading = "lazy", preload = "metadata", decoding = "async" } = options;
  const renderers: Record<string, (node: DocumentNode) => DOMOutputSpec> = {
    image: (node): DOMOutputSpec => [
      "img",
      definedAttrs({
        ...commonAttrs(node),
        src: safeSrc(node),
        // A decorative image keeps an empty alt so assistive technology skips
        // it; that is the whole point of recording the intent separately.
        alt: node.attrs[MEDIA_ATTRS.decorative] === true ? "" : attrString(node, MEDIA_ATTRS.alt),
        loading,
        decoding,
      }),
    ],
    video: (node): DOMOutputSpec => [
      "video",
      definedAttrs({
        ...commonAttrs(node),
        src: safeSrc(node),
        poster: attrString(node, "poster") || undefined,
        controls: node.attrs.controls === false ? undefined : "",
        loop: node.attrs.loop === true ? "" : undefined,
        muted: node.attrs.muted === true ? "" : undefined,
        preload,
      }),
    ],
    audio: (node): DOMOutputSpec => [
      "audio",
      definedAttrs({
        ...commonAttrs(node),
        src: safeSrc(node),
        controls: node.attrs.controls === false ? undefined : "",
        loop: node.attrs.loop === true ? "" : undefined,
        preload,
      }),
    ],
    // An attachment is a download link: meaningful in every context that
    // renders HTML, including print, where a player would be useless.
    file: (node): DOMOutputSpec => {
      const filename = attrString(node, "filename");
      return [
        "a",
        definedAttrs({
          href: safeSrc(node),
          download: filename || undefined,
          "data-media": "file",
          "data-align": attrString(node, MEDIA_ATTRS.align) || undefined,
        }),
        filename || attrString(node, MEDIA_ATTRS.src) || "Attachment",
      ];
    },
    embed: (node): DOMOutputSpec => [
      "iframe",
      definedAttrs({
        ...commonAttrs(node),
        src: safeSrc(node),
        title: attrString(node, MEDIA_ATTRS.alt) || attrString(node, "provider") || undefined,
        // Third-party content must not reach back into the document embedding it.
        sandbox: "allow-scripts allow-same-origin allow-presentation",
        loading,
      }),
    ],
    figure: (node): DOMOutputSpec => [
      "figure",
      definedAttrs({ "data-align": attrString(node, MEDIA_ATTRS.align) || undefined }),
      0,
    ],
    caption: (): DOMOutputSpec => ["figcaption", 0],
  };
  // Sound: each renderer only reads attributes, and is invoked solely for its
  // own registered type — the same narrowing `EditorView` already relies on.
  return renderers as unknown as NodeRenderer<NodeName>;
}

/** Reads a dimension attribute from parsed HTML, ignoring non-numeric values. */
function parseDimension(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Reads an alignment from parsed HTML, falling back to the schema default. */
function parseAlign(element: HTMLElement): Record<string, unknown> {
  const align = element.getAttribute("data-align");
  return isMediaAlignment(align) ? { [MEDIA_ATTRS.align]: align } : {};
}

/** Attributes common to every parsed media element. */
function parseCommon(element: HTMLElement): Record<string, unknown> {
  return {
    [MEDIA_ATTRS.width]: parseDimension(element.getAttribute("width")),
    [MEDIA_ATTRS.height]: parseDimension(element.getAttribute("height")),
    [MEDIA_ATTRS.title]: element.getAttribute("title") ?? "",
    ...parseAlign(element),
  };
}

/**
 * The `src` from a parsed element, or `null` to decline the match entirely.
 *
 * Declining rather than blanking is deliberate: an `<img>` whose only source is
 * a `javascript:` URL carries no content worth keeping, and importing it as an
 * empty image would leave a broken placeholder in the document.
 */
function parsedSrc(element: HTMLElement, attribute = "src"): string | null {
  const src = element.getAttribute(attribute);
  if (!src || !isSafeMediaUrl(src)) {
    return null;
  }
  return src;
}

/**
 * HTML parse rules for the media node types — the inverse of
 * {@link mediaNodeRenderers}, and what makes pasting media from another page or
 * importing an HTML document work.
 *
 * Every rule refuses an unsafe `src`, so sanitization does not depend on the
 * consumer remembering to add it.
 */
export function mediaHtmlParseRules<
  NodeName extends string = MediaSchemaNodeName,
  MarkName extends string = string,
>(): HtmlParseSpec<NodeName, MarkName> {
  const nodes: NodeParseRule<MediaSchemaNodeName>[] = [
    {
      tag: "img",
      node: "image",
      getAttrs: (element) => {
        const src = parsedSrc(element);
        if (src === null) {
          return null;
        }
        const alt = element.getAttribute("alt");
        return {
          ...parseCommon(element),
          [MEDIA_ATTRS.src]: src,
          [MEDIA_ATTRS.alt]: alt ?? "",
          // An absent alt is an authoring omission; an explicitly empty one is
          // the standard way to mark an image decorative.
          [MEDIA_ATTRS.decorative]: alt === "",
        };
      },
    },
    {
      tag: "video",
      node: "video",
      getAttrs: (element) => {
        const src = parsedSrc(element);
        if (src === null) {
          return null;
        }
        return {
          ...parseCommon(element),
          [MEDIA_ATTRS.src]: src,
          poster: element.getAttribute("poster") ?? "",
          controls: element.hasAttribute("controls"),
          loop: element.hasAttribute("loop"),
          muted: element.hasAttribute("muted"),
        };
      },
    },
    {
      tag: "audio",
      node: "audio",
      getAttrs: (element) => {
        const src = parsedSrc(element);
        if (src === null) {
          return null;
        }
        return {
          ...parseCommon(element),
          [MEDIA_ATTRS.src]: src,
          controls: element.hasAttribute("controls"),
          loop: element.hasAttribute("loop"),
        };
      },
    },
    {
      tag: "iframe",
      node: "embed",
      getAttrs: (element) => {
        const src = parsedSrc(element);
        if (src === null) {
          return null;
        }
        return {
          ...parseCommon(element),
          [MEDIA_ATTRS.src]: src,
          [MEDIA_ATTRS.alt]: element.getAttribute("title") ?? "",
        };
      },
    },
    {
      // Only a link explicitly marked as an attachment; an ordinary hyperlink
      // is a link mark, not a media node.
      tag: "a",
      node: "file",
      getAttrs: (element) => {
        if (element.getAttribute("data-media") !== "file") {
          return null;
        }
        const src = parsedSrc(element, "href");
        if (src === null) {
          return null;
        }
        return {
          [MEDIA_ATTRS.src]: src,
          filename: element.getAttribute("download") ?? element.textContent ?? "",
          ...parseAlign(element),
        };
      },
    },
    { tag: "figure", node: "figure", getAttrs: (element) => parseAlign(element) },
    { tag: "figcaption", node: "caption" },
  ];

  // Same narrowing as the renderers: each rule names a media node type, which
  // the consuming schema is expected to declare.
  return { nodes } as unknown as HtmlParseSpec<NodeName, MarkName>;
}
