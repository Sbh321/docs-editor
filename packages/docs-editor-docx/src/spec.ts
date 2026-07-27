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
  },
  levelAttr: "level",
  hrefAttr: "href",
  srcAttr: "src",
  altAttr: "alt",
  colorAttr: "color",
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
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K];
};
