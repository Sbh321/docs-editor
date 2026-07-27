import MarkdownIt from "markdown-it";

import { resolveMarkdownSpec } from "./spec";

import type { MarkdownSpec } from "./spec";
import type { DocumentImporter, DocumentNode, Mark, Schema } from "@sbh321/docs-editor-core";

/** The subset of a markdown-it token this parser reads. */
interface MarkdownToken {
  readonly type: string;
  readonly tag: string;
  readonly content: string;
  readonly children: readonly MarkdownToken[] | null;
  attrGet(name: string): string | null;
}

interface OpenNode<NodeName extends string> {
  readonly type: string;
  readonly attrs?: Record<string, unknown>;
  readonly content: DocumentNode<NodeName>[];
}

/**
 * Parses Markdown into a validated {@link DocumentNode}, using `markdown-it` to
 * tokenize and then rebuilding the tree *through the schema* (so the result is
 * validated like every other import). No ProseMirror involved.
 *
 * `html: false` is set on `markdown-it`, so raw HTML embedded in the Markdown
 * is treated as literal text rather than parsed — arbitrary HTML is never
 * carried through.
 */
export class MarkdownImporter<
  NodeName extends string = string,
  MarkName extends string = string,
> implements DocumentImporter<NodeName> {
  readonly format = "markdown";
  private readonly spec: MarkdownSpec;
  private readonly md: MarkdownIt;

  constructor(
    private readonly schema: Schema<NodeName, MarkName>,
    spec?: Parameters<typeof resolveMarkdownSpec>[0],
  ) {
    this.spec = resolveMarkdownSpec(spec);
    this.md = new MarkdownIt({ html: false });
  }

  parse(input: string): DocumentNode<NodeName> {
    const tokens = this.md.parse(input, {}) as unknown as readonly MarkdownToken[];
    const blocks = this.buildBlocks(tokens);
    const content =
      blocks.length > 0
        ? blocks
        : [this.schema.node(this.spec.nodes.paragraph as NodeName, undefined, [])];
    return this.schema.createDocument(content);
  }

  private buildBlocks(tokens: readonly MarkdownToken[]): DocumentNode<NodeName>[] {
    const { nodes } = this.spec;
    const root: OpenNode<NodeName> = { type: "__root__", content: [] };
    const stack: OpenNode<NodeName>[] = [root];
    const top = (): OpenNode<NodeName> => stack[stack.length - 1] as OpenNode<NodeName>;

    const open = (type: string, attrs?: Record<string, unknown>): void => {
      stack.push({ type, ...(attrs ? { attrs } : {}), content: [] });
    };
    const close = (): void => {
      const node = stack.pop();
      if (!node) {
        return;
      }
      top().content.push(this.schema.node(node.type as NodeName, node.attrs, node.content));
    };

    for (const token of tokens) {
      switch (token.type) {
        case "heading_open":
          open(nodes.heading, { [this.spec.levelAttr]: headingLevel(token.tag) });
          break;
        case "paragraph_open":
          open(nodes.paragraph);
          break;
        case "blockquote_open":
          open(nodes.blockquote);
          break;
        case "bullet_list_open":
          open(nodes.bulletList);
          break;
        case "ordered_list_open":
          open(nodes.orderedList);
          break;
        case "list_item_open":
          open(nodes.listItem);
          break;
        case "heading_close":
        case "paragraph_close":
        case "blockquote_close":
        case "bullet_list_close":
        case "ordered_list_close":
        case "list_item_close":
          close();
          break;
        case "hr":
          top().content.push(this.schema.node(nodes.horizontalRule as NodeName));
          break;
        case "code_block":
        case "fence": {
          const code = token.content.replace(/\n$/, "");
          top().content.push(
            this.schema.node(
              nodes.codeBlock as NodeName,
              undefined,
              code.length > 0 ? [this.schema.text(code)] : [],
            ),
          );
          break;
        }
        case "inline":
          for (const inline of this.buildInline(token.children ?? [])) {
            top().content.push(inline);
          }
          break;
        default:
          break;
      }
    }

    return root.content;
  }

  private buildInline(children: readonly MarkdownToken[]): DocumentNode<NodeName>[] {
    const { marks } = this.spec;
    const result: DocumentNode<NodeName>[] = [];
    const active: Mark<MarkName>[] = [];

    const push = (text: string, extra?: Mark<MarkName>): void => {
      if (text.length === 0) {
        return;
      }
      result.push(this.schema.text(text, extra ? [...active, extra] : [...active]));
    };
    const popMark = (type: string): void => {
      const index = active.map((mark) => mark.type as string).lastIndexOf(type);
      if (index !== -1) {
        active.splice(index, 1);
      }
    };

    for (const token of children) {
      switch (token.type) {
        case "text":
          push(token.content);
          break;
        case "softbreak":
          push(" ");
          break;
        case "hardbreak":
          push("\n");
          break;
        case "code_inline":
          push(token.content, this.schema.mark(marks.code as MarkName));
          break;
        case "strong_open":
          active.push(this.schema.mark(marks.bold as MarkName));
          break;
        case "strong_close":
          popMark(marks.bold);
          break;
        case "em_open":
          active.push(this.schema.mark(marks.italic as MarkName));
          break;
        case "em_close":
          popMark(marks.italic);
          break;
        case "link_open":
          active.push(
            this.schema.mark(marks.link as MarkName, {
              [this.spec.hrefAttr]: token.attrGet("href") ?? "",
            }),
          );
          break;
        case "link_close":
          popMark(marks.link);
          break;
        default:
          break;
      }
    }

    return result;
  }
}

function headingLevel(tag: string): number {
  const level = Number(tag.replace(/^h/i, ""));
  return Number.isFinite(level) ? Math.min(6, Math.max(1, level)) : 1;
}
