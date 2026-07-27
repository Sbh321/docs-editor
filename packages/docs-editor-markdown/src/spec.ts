/**
 * Maps a schema's node/mark *type names* to their Markdown meaning. Different
 * schemas name types differently (`bold` vs `strong`, `divider` vs
 * `horizontal_rule`), so both the exporter and importer take this mapping —
 * defaulting to the common names used across the Docs Editor examples.
 */
export interface MarkdownSpec {
  readonly nodes: {
    readonly paragraph: string;
    readonly heading: string;
    readonly blockquote: string;
    readonly bulletList: string;
    readonly orderedList: string;
    readonly listItem: string;
    readonly codeBlock: string;
    readonly horizontalRule: string;
  };
  readonly marks: {
    readonly bold: string;
    readonly italic: string;
    readonly code: string;
    readonly link: string;
  };
  /** Attribute holding a heading's level. Defaults to `"level"`. */
  readonly levelAttr: string;
  /** Attribute holding a link's URL. Defaults to `"href"`. */
  readonly hrefAttr: string;
}

/** The default type-name mapping (matches the Docs Editor example schemas). */
export const defaultMarkdownSpec: MarkdownSpec = {
  nodes: {
    paragraph: "paragraph",
    heading: "heading",
    blockquote: "blockquote",
    bulletList: "bullet_list",
    orderedList: "ordered_list",
    listItem: "list_item",
    codeBlock: "code_block",
    horizontalRule: "divider",
  },
  marks: {
    bold: "bold",
    italic: "italic",
    code: "code",
    link: "link",
  },
  levelAttr: "level",
  hrefAttr: "href",
};

/** Merges a partial override into {@link defaultMarkdownSpec}. */
export function resolveMarkdownSpec(spec?: DeepPartial<MarkdownSpec>): MarkdownSpec {
  return {
    nodes: { ...defaultMarkdownSpec.nodes, ...spec?.nodes },
    marks: { ...defaultMarkdownSpec.marks, ...spec?.marks },
    levelAttr: spec?.levelAttr ?? defaultMarkdownSpec.levelAttr,
    hrefAttr: spec?.hrefAttr ?? defaultMarkdownSpec.hrefAttr,
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K];
};
