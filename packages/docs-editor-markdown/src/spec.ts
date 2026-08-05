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
    /**
     * Task lists (ROADMAP Phase 9, Milestone 9.3). `- [x] done` is GitHub
     * Flavored Markdown rather than CommonMark, but it is what every tool a
     * document is likely to travel through understands.
     */
    readonly taskList: string;
    readonly taskItem: string;
    readonly codeBlock: string;
    readonly horizontalRule: string;
    /**
     * Media types (ROADMAP Phase 7, Milestone 7.6). Only `image` is native to
     * Markdown; the rest degrade to links on export and are documented in the
     * package README. Naming them here means a schema that omits a type simply
     * never matches, rather than needing separate configuration.
     */
    readonly image: string;
    readonly video: string;
    readonly audio: string;
    readonly file: string;
    readonly embed: string;
    readonly figure: string;
    readonly caption: string;
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
  /** Attribute holding a media node's source URL. Defaults to `"src"`. */
  readonly srcAttr: string;
  /** Attribute holding a media node's alternative text. Defaults to `"alt"`. */
  readonly altAttr: string;
  /** Attribute holding a media node's advisory title. Defaults to `"title"`. */
  readonly titleAttr: string;
  /** Attribute holding a file attachment's name. Defaults to `"filename"`. */
  readonly filenameAttr: string;
  /** Attribute holding a task item's checked state. Defaults to `"checked"`. */
  readonly checkedAttr: string;
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
    taskList: "task_list",
    taskItem: "task_item",
    codeBlock: "code_block",
    horizontalRule: "divider",
    image: "image",
    video: "video",
    audio: "audio",
    file: "file",
    embed: "embed",
    figure: "figure",
    caption: "caption",
  },
  marks: {
    bold: "bold",
    italic: "italic",
    code: "code",
    link: "link",
  },
  levelAttr: "level",
  hrefAttr: "href",
  srcAttr: "src",
  altAttr: "alt",
  titleAttr: "title",
  filenameAttr: "filename",
  checkedAttr: "checked",
};

/** Merges a partial override into {@link defaultMarkdownSpec}. */
export function resolveMarkdownSpec(spec?: DeepPartial<MarkdownSpec>): MarkdownSpec {
  return {
    nodes: { ...defaultMarkdownSpec.nodes, ...spec?.nodes },
    marks: { ...defaultMarkdownSpec.marks, ...spec?.marks },
    levelAttr: spec?.levelAttr ?? defaultMarkdownSpec.levelAttr,
    hrefAttr: spec?.hrefAttr ?? defaultMarkdownSpec.hrefAttr,
    srcAttr: spec?.srcAttr ?? defaultMarkdownSpec.srcAttr,
    altAttr: spec?.altAttr ?? defaultMarkdownSpec.altAttr,
    titleAttr: spec?.titleAttr ?? defaultMarkdownSpec.titleAttr,
    filenameAttr: spec?.filenameAttr ?? defaultMarkdownSpec.filenameAttr,
    checkedAttr: spec?.checkedAttr ?? defaultMarkdownSpec.checkedAttr,
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K];
};
