import { isTextNode } from "@sbh321/docs-editor-core";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";

import { resolveDocxSpec } from "./spec";

import type { DocxAsset, DocxAssetResolver, DocxSpec } from "./spec";
import type { DocumentExporter, DocumentNode, Mark } from "@sbh321/docs-editor-core";

/** The `docx` numbering definition ordered lists reference. */
const ORDERED_REFERENCE = "docs-editor-ordered";
/** Twips of indentation per nesting level (720 twips = 0.5in). */
const INDENT_STEP = 720;
const CODE_FONT = "Courier New";

type BlockChild = Paragraph | Table;
type InlineChild = TextRun | ExternalHyperlink;

interface ListContext {
  readonly kind: "bullet" | "ordered";
  readonly level: number;
}

interface BlockContext {
  /** Left indentation in twips (accumulated by blockquotes/list continuations). */
  readonly indent?: number;
  /** Set while inside a list, so a nested list can compute its deeper level. */
  readonly list?: ListContext;
}

/**
 * Serializes a {@link DocumentNode} to a Microsoft Word `.docx` file (as bytes)
 * by mapping the plain document tree onto the `docx` library's object model — no
 * ProseMirror involved, so this package never touches the engine.
 *
 * Binary and asynchronous by nature, so it implements the generalized
 * {@link DocumentExporter} contract with an `Output` of `Promise<Uint8Array>`.
 *
 * Faithful within what DOCX and this mapping express (headings, paragraphs,
 * blockquotes, bullet/ordered lists, code blocks, dividers, tables, and the
 * bold/italic/underline/strikethrough/code/link marks), plus text and highlight
 * colour.
 *
 * Images embed for real when a {@link DocxAssetResolver} is supplied — the
 * exporter asks the application for bytes and never fetches them itself, the
 * same boundary as media upload. Without a resolver, or when one declines, an
 * image degrades to its alt text rather than failing the export. Remaining
 * documented lossy cases: video, audio, attachments and embeds degrade to their
 * inline text, as do unknown block nodes.
 */
export class DocxExporter<NodeName extends string = string> implements DocumentExporter<
  NodeName,
  Promise<Uint8Array>
> {
  readonly format = "docx";
  private readonly spec: DocxSpec;
  private readonly resolveAsset: DocxAssetResolver | undefined;
  /** Bytes resolved for this serialization pass, keyed by source. */
  private assets: ReadonlyMap<string, DocxAsset> = new Map();

  constructor(options: DocxExporterOptions = {}) {
    this.spec = resolveDocxSpec(options.spec);
    this.resolveAsset = options.resolveAsset;
  }

  async serialize(doc: DocumentNode<NodeName>): Promise<Uint8Array> {
    // Resolve every image up front: building the document is synchronous, and
    // threading a promise through the whole tree walk would complicate every
    // node type for the sake of one.
    this.assets = await this.collectAssets(doc);

    const children = this.serializeBlocks(doc.content, {});
    const file = new Document({
      numbering: {
        config: [
          {
            reference: ORDERED_REFERENCE,
            levels: [0, 1, 2, 3, 4, 5].map((level) => ({
              level,
              format: LevelFormat.DECIMAL,
              text: `%${level + 1}.`,
              alignment: AlignmentType.START,
            })),
          },
        ],
      },
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(file);
    return new Uint8Array(await blob.arrayBuffer());
  }

  private serializeBlocks(nodes: readonly DocumentNode[], ctx: BlockContext): BlockChild[] {
    return nodes.flatMap((node) => this.serializeBlock(node, ctx));
  }

  private serializeBlock(node: DocumentNode, ctx: BlockContext): BlockChild[] {
    const { nodes } = this.spec;
    // The block's own indent attribute adds to whatever nesting already applies
    // (blockquotes, list continuations), so an indented paragraph inside a quote
    // lands where the screen shows it.
    const ownIndent = this.indentOf(node) * INDENT_STEP;
    const totalIndent = (ctx.indent ?? 0) + ownIndent;
    const indentOpt = {
      ...(totalIndent ? { indent: { left: totalIndent } } : {}),
      ...this.alignmentOf(node),
    };

    switch (node.type) {
      case nodes.heading:
        return [
          new Paragraph({
            heading: headingLevel(this.levelOf(node)),
            children: this.inline(node),
            ...indentOpt,
          }),
        ];
      case nodes.paragraph:
      case nodes.caption:
        return [new Paragraph({ children: this.inline(node), ...indentOpt })];
      case nodes.blockquote:
        return this.serializeBlocks(node.content, {
          ...ctx,
          indent: (ctx.indent ?? 0) + INDENT_STEP,
        });
      case nodes.codeBlock:
        return [this.codeParagraph(node, indentOpt)];
      case nodes.horizontalRule:
        return [new Paragraph({ thematicBreak: true })];
      case nodes.bulletList:
        return this.serializeList(node, ctx, "bullet");
      case nodes.taskList:
        return this.serializeList(node, ctx, "bullet");
      case nodes.orderedList:
        return this.serializeList(node, ctx, "ordered");
      case nodes.table:
        return [this.serializeTable(node)];
      case nodes.figure:
        return this.serializeBlocks(node.content, ctx);
      case nodes.image:
        return [this.imageParagraph(node, indentOpt)];
      default:
        // Unknown block: fall back to its inline text so nothing is silently lost.
        return [new Paragraph({ children: this.inline(node), ...indentOpt })];
    }
  }

  private serializeList(
    node: DocumentNode,
    ctx: BlockContext,
    kind: "bullet" | "ordered",
  ): BlockChild[] {
    const level = ctx.list ? ctx.list.level + 1 : 0;
    const listCtx: ListContext = { kind, level };
    return node.content.flatMap((item) => this.serializeListItem(item, listCtx));
  }

  private serializeListItem(item: DocumentNode, listCtx: ListContext): BlockChild[] {
    const { nodes } = this.spec;
    const out: BlockChild[] = [];
    let markerApplied = false;
    // A checklist degrades to a bullet list whose text begins with a ballot box.
    // DOCX *can* carry a real content-control checkbox, but only Word renders
    // one; every other reader shows an empty gap where the state should be.
    // A glyph is legible everywhere and survives a copy into plain text.
    const checkbox = item.type === nodes.taskItem ? this.checkboxGlyph(item) : null;

    for (const child of item.content) {
      if (!markerApplied && (child.type === nodes.paragraph || child.type === nodes.heading)) {
        const children = this.inline(child);
        out.push(
          new Paragraph({
            children: checkbox === null ? children : [new TextRun({ text: checkbox }), ...children],
            ...listMarker(listCtx),
          }),
        );
        markerApplied = true;
      } else {
        // Continuation blocks (and nested lists) sit under the marker, indented
        // and carrying the list context so a nested list deepens its level.
        out.push(
          ...this.serializeBlock(child, {
            list: listCtx,
            indent: INDENT_STEP * (listCtx.level + 1),
          }),
        );
      }
    }
    return out;
  }

  private serializeTable(node: DocumentNode): Table {
    const { nodes } = this.spec;
    const rows = node.content.map(
      (row) =>
        new TableRow({
          children: row.content.map(
            (cell) =>
              new TableCell({
                children: asParagraphs(this.serializeBlocks(cell.content, {})),
                ...(cell.type === nodes.tableHeader ? { shading: { fill: "F2F2F2" } } : {}),
              }),
          ),
        }),
    );
    return new Table({ rows });
  }

  private codeParagraph(node: DocumentNode, indentOpt: Record<string, unknown>): Paragraph {
    const code = node.content.map((child) => (isTextNode(child) ? child.text : "")).join("");
    const lines = code.split("\n");
    const children = lines.flatMap((line, index) => {
      const run = new TextRun({ text: line, font: CODE_FONT });
      return index === 0 ? [run] : [new TextRun({ break: 1, font: CODE_FONT }), run];
    });
    return new Paragraph({ children, ...indentOpt });
  }

  private imageParagraph(node: DocumentNode, indentOpt: Record<string, unknown>): Paragraph {
    const altAttr = node.attrs[this.spec.altAttr];
    const alt = (typeof altAttr === "string" ? altAttr : "").trim();
    const src =
      typeof node.attrs[this.spec.srcAttr] === "string"
        ? (node.attrs[this.spec.srcAttr] as string)
        : "";
    const asset = this.assets.get(src);

    if (asset) {
      const { width, height } = imageSize(node, asset);
      return new Paragraph({
        children: [
          new ImageRun({
            type: asset.type ?? imageTypeFromSrc(src),
            data: asset.data,
            transformation: { width, height },
            ...(alt ? { altText: { name: alt, description: alt, title: alt } } : {}),
          }),
        ],
        ...indentOpt,
      });
    }

    // No resolver, or the resolver declined: degrade to alt text rather than
    // failing the export or emitting an empty frame.
    return new Paragraph({
      children: [new TextRun({ text: alt.length > 0 ? alt : "[image]", italics: true })],
      ...indentOpt,
    });
  }

  /** Resolves every distinct image source in the document, in parallel. */
  private async collectAssets(
    doc: DocumentNode<NodeName>,
  ): Promise<ReadonlyMap<string, DocxAsset>> {
    const resolve = this.resolveAsset;
    if (!resolve) {
      return new Map();
    }

    const sources = new Set<string>();
    const walk = (nodes: readonly DocumentNode[]): void => {
      for (const node of nodes) {
        if (node.type === this.spec.nodes.image) {
          const src = node.attrs[this.spec.srcAttr];
          if (typeof src === "string" && src.length > 0) {
            sources.add(src);
          }
        }
        walk(node.content);
      }
    };
    walk(doc.content);

    const resolved = new Map<string, DocxAsset>();
    await Promise.all(
      [...sources].map(async (src) => {
        try {
          const asset = await resolve(src);
          if (asset) {
            resolved.set(src, asset);
          }
        } catch {
          // One unreachable image must not fail the whole export; it falls back
          // to alt text like any other unresolved source.
        }
      }),
    );
    return resolved;
  }

  private inline(node: DocumentNode): InlineChild[] {
    return node.content.flatMap((child) => this.inlineChild(child));
  }

  private inlineChild(node: DocumentNode): InlineChild[] {
    if (!isTextNode(node)) {
      // A non-text inline node (none in the common set) — emit its text content.
      return node.content.flatMap((child) => this.inlineChild(child));
    }

    const { marks } = this.spec;
    const has = (type: string) => node.marks.some((mark) => mark.type === type);
    const colorOf = (type: string) => {
      const mark = node.marks.find((entry) => entry.type === type);
      return mark ? hexColor(mark.attrs[this.spec.colorAttr]) : undefined;
    };

    const textColor = colorOf(marks.textColor);
    const highlightColor = colorOf(marks.highlight);
    const sizeMark = node.marks.find((mark) => mark.type === marks.fontSize);
    const rawSize = sizeMark?.attrs[this.spec.sizeAttr];
    const fontSize =
      typeof rawSize === "number" && Number.isFinite(rawSize) && rawSize > 0
        ? Math.round(rawSize)
        : undefined;

    const run = new TextRun({
      text: node.text,
      ...(has(marks.bold) ? { bold: true } : {}),
      ...(has(marks.italic) ? { italics: true } : {}),
      ...(has(marks.underline) ? { underline: {} } : {}),
      ...(has(marks.strikethrough) ? { strike: true } : {}),
      ...(has(marks.code) ? { font: CODE_FONT } : {}),
      // DOCX stores sizes in half-points, which is exactly why the model stores
      // points: the conversion is a doubling rather than a rounded guess.
      ...(fontSize === undefined ? {} : { size: fontSize * 2 }),
      ...(textColor ? { color: textColor } : {}),
      ...(highlightColor
        ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: highlightColor } }
        : {}),
    });

    const link = node.marks.find((mark) => mark.type === marks.link);
    if (link) {
      return [new ExternalHyperlink({ children: [run], link: this.hrefOf(link) })];
    }
    return [run];
  }

  /**
   * The DOCX alignment for a block, if it declares one.
   *
   * `justify` maps to `BOTH`, which is what Word calls justified text.
   */
  private alignmentOf(node: DocumentNode): {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } {
    const align = node.attrs[this.spec.alignAttr];
    switch (align) {
      case "center":
        return { alignment: AlignmentType.CENTER };
      case "right":
        return { alignment: AlignmentType.RIGHT };
      case "justify":
        return { alignment: AlignmentType.BOTH };
      case "left":
        return { alignment: AlignmentType.LEFT };
      default:
        return {};
    }
  }

  /** `\u2612 ` or `\u2610 ` — a ballot box, rendered by every DOCX reader. */
  private checkboxGlyph(item: DocumentNode): string {
    return item.attrs[this.spec.checkedAttr] === true ? "\u2612 " : "\u2610 ";
  }

  private indentOf(node: DocumentNode): number {
    const indent = node.attrs[this.spec.indentAttr];
    return typeof indent === "number" && Number.isFinite(indent) && indent > 0
      ? Math.round(indent)
      : 0;
  }

  private levelOf(node: DocumentNode): number {
    const level = node.attrs[this.spec.levelAttr];
    return typeof level === "number" ? level : 1;
  }

  private hrefOf(mark: Mark): string {
    const href = mark.attrs[this.spec.hrefAttr];
    return typeof href === "string" ? href : "";
  }
}

function listMarker(listCtx: ListContext): Record<string, unknown> {
  if (listCtx.kind === "bullet") {
    return { bullet: { level: listCtx.level } };
  }
  return { numbering: { reference: ORDERED_REFERENCE, level: listCtx.level } };
}

function headingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const clamped = Math.min(6, Math.max(1, level));
  const map = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];
  return map[clamped - 1] as (typeof HeadingLevel)[keyof typeof HeadingLevel];
}

export interface DocxExporterOptions {
  /** Maps the schema's type names to their DOCX meaning. */
  readonly spec?: Parameters<typeof resolveDocxSpec>[0];
  /**
   * Supplies image bytes so images embed rather than degrading to alt text.
   * Omit to keep the alt-text fallback.
   */
  readonly resolveAsset?: DocxAssetResolver;
}

/** Default width, in pixels, for an image with no size information at all. */
const DEFAULT_IMAGE_WIDTH = 400;

/** The image size to embed at, preferring the node's own, then the asset's. */
function imageSize(
  node: DocumentNode,
  asset: DocxAsset,
): { readonly width: number; readonly height: number } {
  const nodeWidth = typeof node.attrs.width === "number" ? node.attrs.width : undefined;
  const nodeHeight = typeof node.attrs.height === "number" ? node.attrs.height : undefined;

  const width = nodeWidth ?? asset.width ?? DEFAULT_IMAGE_WIDTH;
  // Keep the asset's aspect ratio when only a width is known, rather than
  // guessing a square.
  const aspect = asset.width && asset.height ? asset.height / asset.width : 0.75;
  const height = nodeHeight ?? Math.round(width * aspect);
  return { width, height };
}

/** DOCX needs an explicit format; infer it from the source's extension. */
function imageTypeFromSrc(src: string): "png" | "jpg" | "gif" | "bmp" {
  const extension = src.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "jpg";
    case "gif":
      return "gif";
    case "bmp":
      return "bmp";
    default:
      return "png";
  }
}

/** Normalizes a color attr to the `RRGGBB` hex DOCX expects, or `undefined` if not a hex color. */
function hexColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  return match ? match[1]!.toUpperCase() : undefined;
}

/** A DOCX table cell needs at least one paragraph; drop any nested tables to be safe. */
function asParagraphs(blocks: BlockChild[]): Paragraph[] {
  const paragraphs = blocks.filter((block): block is Paragraph => block instanceof Paragraph);
  return paragraphs.length > 0 ? paragraphs : [new Paragraph({})];
}
