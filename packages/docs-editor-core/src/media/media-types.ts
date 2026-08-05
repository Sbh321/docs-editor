/**
 * Shared media vocabulary (ROADMAP Phase 7 — Media, Milestone 7.1).
 *
 * Images, video, audio, file attachments and embeds are all built on one
 * foundation rather than five near-identical implementations, so the attribute
 * names, alignment values and upload-correlation id below are deliberately
 * shared across every media node type.
 */

/**
 * How a media node sits relative to the text column.
 *
 * `wide` and `full` exist because documents routinely want a figure that breaks
 * out of the text measure — without them every consumer reinvents the same two
 * values under different names.
 */
export const MEDIA_ALIGNMENTS = ["left", "center", "right", "wide", "full"] as const;

/** A value in {@link MEDIA_ALIGNMENTS}. */
export type MediaAlignment = (typeof MEDIA_ALIGNMENTS)[number];

/** Narrows an unknown value (e.g. a node attribute) to a {@link MediaAlignment}. */
export function isMediaAlignment(value: unknown): value is MediaAlignment {
  return typeof value === "string" && (MEDIA_ALIGNMENTS as readonly string[]).includes(value);
}

/**
 * The node group every media node type joins, so containers can accept "any
 * media" without enumerating types — `figure`'s content is `"media caption?"`.
 * Media nodes belong to both this group and their block group.
 */
export const MEDIA_GROUP = "media";

/**
 * Attribute names shared by every media node type. Serializers, commands and
 * adapters key off these, so they are named once here rather than spelled out
 * as string literals at each use.
 */
export const MEDIA_ATTRS = {
  /** Where the media is loaded from. Empty until an upload resolves. */
  src: "src",
  /** Alternative text. Required for accessibility on images; see `decorative`. */
  alt: "alt",
  /** Advisory title, surfaced as a tooltip by most renderers. */
  title: "title",
  /** Rendered width in CSS pixels, or `null` for the media's natural width. */
  width: "width",
  /** Rendered height in CSS pixels, or `null` for the media's natural height. */
  height: "height",
  /** One of {@link MEDIA_ALIGNMENTS}. */
  align: "align",
  /**
   * Marks an image as purely decorative, so assistive technology skips it. This
   * is a deliberate, explicit choice rather than the accidental empty `alt` that
   * an author leaves behind — the two are indistinguishable in HTML, so the
   * model records the intent.
   */
  decorative: "decorative",
  /**
   * Stable identifier correlating a node with an in-flight upload.
   *
   * Upload progress lives in a registry outside the document (see
   * ARCHITECTURE's Media Architecture), and by the time an upload finishes the
   * user may have typed above the node and moved it. Resolving this id to the
   * node's *current* position is what makes completion land in the right place
   * instead of at a remembered — and by then stale — position.
   */
  mediaId: "mediaId",
} as const;

/** Media node types provided by the core. */
export const MEDIA_NODE_TYPES = ["image", "video", "audio", "file", "embed"] as const;

/** A media node type name. */
export type MediaNodeType = (typeof MEDIA_NODE_TYPES)[number];

/** Narrows an unknown value to a {@link MediaNodeType}. */
export function isMediaNodeType(value: unknown): value is MediaNodeType {
  return typeof value === "string" && (MEDIA_NODE_TYPES as readonly string[]).includes(value);
}
