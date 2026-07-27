import { isTextNode } from "@sbh321/docs-editor-core";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";

import { resolveDocxSpec } from "./spec";

import type { DocxSpec } from "./spec";
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
 * bold/italic/underline/strikethrough/code/link marks). Documented lossy cases:
 * images render as their alt text (inline image embedding is a future
 * enhancement), and unknown block nodes degrade to their inline text.
 */
export class DocxExporter<NodeName extends string = string> implements DocumentExporter<
  NodeName,
  Promise<Uint8Array>
> {
  readonly format = "docx";
  private readonly spec: DocxSpec;

  constructor(spec?: Parameters<typeof resolveDocxSpec>[0]) {
    this.spec = resolveDocxSpec(spec);
  }

  async serialize(doc: DocumentNode<NodeName>): Promise<Uint8Array> {
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
    const indentOpt = ctx.indent ? { indent: { left: ctx.indent } } : {};

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

    for (const child of item.content) {
      if (!markerApplied && (child.type === nodes.paragraph || child.type === nodes.heading)) {
        out.push(new Paragraph({ children: this.inline(child), ...listMarker(listCtx) }));
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
    return new Paragraph({
      children: [new TextRun({ text: alt.length > 0 ? alt : "[image]", italics: true })],
      ...indentOpt,
    });
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

    const run = new TextRun({
      text: node.text,
      ...(has(marks.bold) ? { bold: true } : {}),
      ...(has(marks.italic) ? { italics: true } : {}),
      ...(has(marks.underline) ? { underline: {} } : {}),
      ...(has(marks.strikethrough) ? { strike: true } : {}),
      ...(has(marks.code) ? { font: CODE_FONT } : {}),
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
