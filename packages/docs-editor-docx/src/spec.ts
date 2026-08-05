/**
 * Maps a schema's node/mark *type names* to their DOCX meaning. Different
 * schemas name types differently (`bold` vs `strong`, `divider` vs
 * `horizontal_rule`), so both the exporter and importer take this mapping —
 * defaulting to the common names used across the Docs Editor examples. Same idea
 * as `MarkdownSpec` in `@sbh321/docs-editor-markdown`.
 */
export interface DocxSpec {
  readonly nodes: {
    readonly paragraph: string;
    readonly heading: string;
    readonly blockquote: string;
    readonly bulletList: string;
    readonly orderedList: string;
    readonly listItem: string;
    /** Task lists (ROADMAP Phase 9, Milestone 9.3). */
    readonly taskList: string;
    readonly taskItem: string;
    readonly codeBlock: string;
    readonly horizontalRule: string;
    readonly image: string;
    readonly figure: string;
    readonly caption: string;
    readonly table: string;
    readonly tableRow: string;
    readonly tableCell: string;
    readonly tableHeader: string;
  };
  readonly marks: {
    readonly bold: string;
    readonly italic: string;
    readonly underline: string;
    readonly strikethrough: string;
    readonly code: string;
    readonly link: string;
    readonly highlight: string;
    readonly textColor: string;
    /** Font size, stored in points (ROADMAP Phase 9, Milestone 9.2). */
    readonly fontSize: string;
  };
  /** Attribute holding a heading's level. Defaults to `"level"`. */
  readonly levelAttr: string;
  /** Attribute holding a link's URL. Defaults to `"href"`. */
  readonly hrefAttr: string;
  /** Attribute holding an image's source. Defaults to `"src"`. */
  readonly srcAttr: string;
  /** Attribute holding an image's alt text. Defaults to `"alt"`. */
  readonly altAttr: string;
  /** Attribute holding a color value on the highlight/text-color marks. Defaults to `"color"`. */
  readonly colorAttr: string;
  /** Attribute holding a block's alignment. Defaults to `"align"`. */
  readonly alignAttr: string;
  /** Attribute holding a block's indent level. Defaults to `"indent"`. */
  readonly indentAttr: string;
  /** Attribute holding a font size in points. Defaults to `"size"`. */
  readonly sizeAttr: string;
  /** Attribute holding a task item's checked state. Defaults to `"checked"`. */
  readonly checkedAttr: string;
}

/** The default type-name mapping (matches the Docs Editor example schemas). */
export const defaultDocxSpec: DocxSpec = {
  nodes: {
    paragraph: "paragraph",
    heading: "heading",
    blockquote: "blockquote",
    bulletList: "bullet_list",
    orderedList: "ordered_list",
    listItem: "list_item",
    taskList: "task_list",
    taskItem: "task_item",
    codeBlock: "code_block",
    horizontalRule: "divider",
    image: "image",
    figure: "figure",
    caption: "caption",
    table: "table",
    tableRow: "table_row",
    tableCell: "table_cell",
    tableHeader: "table_header",
  },
  marks: {
    bold: "bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "strikethrough",
    code: "code",
    link: "link",
    highlight: "highlight",
    textColor: "text_color",
    fontSize: "font_size",
  },
  levelAttr: "level",
  hrefAttr: "href",
  srcAttr: "src",
  altAttr: "alt",
  colorAttr: "color",
  alignAttr: "align",
  indentAttr: "indent",
  sizeAttr: "size",
  checkedAttr: "checked",
};

/** Merges a partial override into {@link defaultDocxSpec}. */
export function resolveDocxSpec(spec?: DeepPartial<DocxSpec>): DocxSpec {
  return {
    nodes: { ...defaultDocxSpec.nodes, ...spec?.nodes },
    marks: { ...defaultDocxSpec.marks, ...spec?.marks },
    levelAttr: spec?.levelAttr ?? defaultDocxSpec.levelAttr,
    hrefAttr: spec?.hrefAttr ?? defaultDocxSpec.hrefAttr,
    srcAttr: spec?.srcAttr ?? defaultDocxSpec.srcAttr,
    altAttr: spec?.altAttr ?? defaultDocxSpec.altAttr,
    colorAttr: spec?.colorAttr ?? defaultDocxSpec.colorAttr,
    alignAttr: spec?.alignAttr ?? defaultDocxSpec.alignAttr,
    indentAttr: spec?.indentAttr ?? defaultDocxSpec.indentAttr,
    sizeAttr: spec?.sizeAttr ?? defaultDocxSpec.sizeAttr,
    checkedAttr: spec?.checkedAttr ?? defaultDocxSpec.checkedAttr,
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K];
};

/**
 * An image's bytes, resolved by the application for embedding.
 *
 * The exporter never fetches: retrieving bytes means credentials, CORS, storage
 * and caching — application concerns, exactly like uploading. See
 * {@link DocxAssetResolver}.
 */
export interface DocxAsset {
  readonly data: Uint8Array;
  /**
   * Image format. Inferred from the source's file extension when omitted, so a
   * resolver only needs to supply it for URLs that do not carry one.
   */
  readonly type?: "png" | "jpg" | "gif" | "bmp";
  /** Intrinsic width in pixels, used when the node does not specify a size. */
  readonly width?: number;
  /** Intrinsic height in pixels, used when the node does not specify a size. */
  readonly height?: number;
}

/**
 * Resolves an image's `src` to its bytes, or `null` to fall back to alt text.
 *
 * ```ts
 * const resolveAsset: DocxAssetResolver = async (src) => {
 *   const response = await fetch(src);
 *   if (!response.ok) {
 *     return null;
 *   }
 *   return { data: new Uint8Array(await response.arrayBuffer()) };
 * };
 * ```
 *
 * Returning `null` is a normal outcome, not an error: an image behind auth or
 * a dead link should degrade to its alt text rather than fail the whole export.
 */
export type DocxAssetResolver = (src: string) => Promise<DocxAsset | null> | DocxAsset | null;
