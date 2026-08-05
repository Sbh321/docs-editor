/**
 * Reusable media node shapes (ROADMAP Phase 7 — Media, Milestone 7.1).
 *
 * The core stays schema-agnostic: it does not impose a document schema, it
 * supplies the *shapes* and the consumer composes them. So this returns plain
 * {@link NodeSpec}s to spread into `createSchema`, exactly like hand-written
 * ones — no new schema concept to learn, and any field can be overridden.
 *
 * ```ts
 * const media = mediaNodeSpecs();
 * const schema = createSchema({
 *   topNode: "doc",
 *   nodes: {
 *     doc: { content: "block+" },
 *     paragraph: { group: "block", content: "inline*" },
 *     text: { group: "inline", isText: true, marks: "all" },
 *     ...media,
 *   },
 * });
 * ```
 */

import { MEDIA_ATTRS, MEDIA_GROUP } from "./media-types";

import type { MediaAlignment } from "./media-types";
import type { AttributeSpec, NodeSpec } from "../schema";

/** Node type names produced by {@link mediaNodeSpecs}. */
export type MediaSchemaNodeName =
  "image" | "video" | "audio" | "file" | "embed" | "figure" | "caption";

export interface MediaNodeSpecOptions {
  /**
   * Block group the media nodes join, so they are allowed wherever that group
   * is. Defaults to `"block"`. They additionally always join
   * {@link MEDIA_GROUP}, which is how `figure` accepts any media type.
   */
  readonly group?: string;
  /** Initial alignment for newly created media. Defaults to `"center"`. */
  readonly defaultAlignment?: MediaAlignment;
}

/**
 * Attributes every media node carries.
 *
 * `src` defaults to an empty string rather than being required, for two
 * reasons: a node exists before its upload resolves, and a node type used in a
 * *required* content position (`figure`'s `"media caption?"`) must be
 * constructible from defaults alone or the engine's schema compiler rejects it.
 */
function baseMediaAttrs(defaultAlignment: MediaAlignment): Record<string, AttributeSpec> {
  return {
    [MEDIA_ATTRS.src]: { default: "" },
    [MEDIA_ATTRS.title]: { default: "" },
    [MEDIA_ATTRS.width]: { default: null },
    [MEDIA_ATTRS.height]: { default: null },
    [MEDIA_ATTRS.align]: { default: defaultAlignment },
    [MEDIA_ATTRS.mediaId]: { default: null },
  };
}

/**
 * Builds the media node specs. Every returned entry is an ordinary `NodeSpec`,
 * so a consumer can take a subset, or spread one and override a field:
 *
 * ```ts
 * const { image, figure, caption } = mediaNodeSpecs();          // images only
 * const wide = { ...image, group: "block media hero" };          // customized
 * ```
 */
export function mediaNodeSpecs(
  options: MediaNodeSpecOptions = {},
): Record<MediaSchemaNodeName, NodeSpec> {
  const { group = "block", defaultAlignment = "center" } = options;
  const blockGroup = `${group} ${MEDIA_GROUP}`;
  const base = baseMediaAttrs(defaultAlignment);

  return {
    // Leaf nodes: no `content` at all, so the engine renders each as a single
    // non-editable unit the cursor cannot enter. All are `draggable` (the
    // figure wrapper too): without it the browser runs its *native* image
    // drag, the engine never learns the drag is a move, and dropping inserts
    // a copy while the source stays — a silent duplication (fixed in Phase
    // 9.13). With it, dragging moves; holding Ctrl/Alt while dropping copies,
    // matching every desktop editor.
    image: {
      group: blockGroup,
      draggable: true,
      attrs: {
        ...base,
        [MEDIA_ATTRS.alt]: { default: "" },
        [MEDIA_ATTRS.decorative]: { default: false },
      },
    },
    video: {
      group: blockGroup,
      draggable: true,
      attrs: {
        ...base,
        [MEDIA_ATTRS.alt]: { default: "" },
        /** Still frame shown before playback begins. */
        poster: { default: "" },
        controls: { default: true },
        autoplay: { default: false },
        loop: { default: false },
        /** Browsers only permit autoplay while muted, so the two travel together. */
        muted: { default: false },
      },
    },
    audio: {
      group: blockGroup,
      draggable: true,
      attrs: {
        ...base,
        [MEDIA_ATTRS.alt]: { default: "" },
        controls: { default: true },
        loop: { default: false },
      },
    },
    /** A downloadable attachment, rendered as a named link rather than played. */
    file: {
      group: blockGroup,
      draggable: true,
      attrs: {
        ...base,
        filename: { default: "" },
        /** Size in bytes, or `null` when unknown. */
        size: { default: null },
        mimeType: { default: "" },
      },
    },
    /**
     * A generic third-party embed. Resolving a URL into provider-specific markup
     * (oEmbed) needs network access and provider knowledge, so it stays outside
     * the core — this node is the extension point a plugin fills in.
     */
    embed: {
      group: blockGroup,
      draggable: true,
      attrs: {
        ...base,
        [MEDIA_ATTRS.alt]: { default: "" },
        /** Provider name, when a resolver identified one (e.g. `"youtube"`). */
        provider: { default: "" },
        /** Width divided by height, used to reserve space before load. */
        aspectRatio: { default: null },
      },
    },
    /**
     * Pairs any media with an optional caption. Its content references the
     * shared `media` group, so it accepts every media type without enumerating
     * them — and keeps working when a consumer adds their own.
     */
    figure: { group, content: `${MEDIA_GROUP} caption?`, draggable: true },
    caption: { content: "inline*" },
  };
}
