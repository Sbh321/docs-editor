import { isSafeMediaUrl } from "@sbh321/docs-editor-core";
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
    const blocks = this.buildBlocks(tokens).map((block) => this.adoptTaskLists(block));
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
        case "inline": {
          // `![alt](src)` alone in a paragraph is Markdown's idiom for a
          // standalone image, and the media node catalog models images as
          // blocks — so promote it to one rather than burying a block-level
          // concept inside a paragraph. Images mixed with text stay inline and
          // degrade to links (see `buildInline`).
          const image = this.standaloneImageAttrs(token);
          if (image && top().type === nodes.paragraph && top().content.length === 0) {
            stack[stack.length - 1] = { type: nodes.image, attrs: image, content: [] };
            break;
          }
          for (const inline of this.buildInline(token.children ?? [])) {
            top().content.push(inline);
          }
          break;
        }
        default:
          break;
      }
    }

    return root.content;
  }

  /**
   * Rewrites bullet lists whose items all begin with `[ ]` or `[x]` into task
   * lists, stripping the marker text.
   *
   * Done as a pass over the built document rather than during tokenization
   * because markdown-it has no notion of task lists: they reach the parser as
   * ordinary bullet items whose first text happens to start with `[x] `. Trying
   * to intercept that mid-parse means reaching into inline token streams; a
   * structural rewrite afterwards is smaller and easier to be sure of.
   *
   * **Every** item must carry a marker. GitHub renders a mixed list with
   * checkboxes only on the marked items, but this model has no way to express
   * an unchecked *non-task* item, so a mixed list stays a bullet list with its
   * `[x]` text intact — visible and lossless, rather than silently promoting
   * plain items to unchecked tasks.
   */
  private adoptTaskLists(node: DocumentNode<NodeName>): DocumentNode<NodeName> {
    const { nodes } = this.spec;
    // Text nodes are leaves and are not built through `schema.node` — recursing
    // into one and rebuilding it throws.
    if (typeof node.text === "string") {
      return node;
    }

    let changed = false;
    const content = node.content.map((child) => {
      const next = this.adoptTaskLists(child);
      changed ||= next !== child;
      return next;
    });

    const isConvertible =
      node.type === (nodes.bulletList as NodeName) &&
      this.hasNodeType(nodes.taskList) &&
      this.hasNodeType(nodes.taskItem) &&
      content.length > 0 &&
      content.every((item) => readTaskMarker(item) !== null);

    if (!isConvertible) {
      // Rebuilt only when a descendant actually changed, so an untouched
      // document keeps its existing nodes and their structural sharing.
      return changed ? this.schema.node(node.type, node.attrs, content) : node;
    }

    const items = content.map((item) => {
      const marker = readTaskMarker(item);
      return this.schema.node(
        nodes.taskItem as NodeName,
        { [this.spec.checkedAttr]: marker?.checked ?? false },
        this.stripTaskMarker(item),
      );
    });
    return this.schema.node(nodes.taskList as NodeName, undefined, items);
  }

  /** Rebuilds a list item's blocks with the leading `[x] ` removed. */
  private stripTaskMarker(item: DocumentNode<NodeName>): DocumentNode<NodeName>[] {
    const [first, ...rest] = item.content;
    if (!first) {
      return [];
    }
    const [firstText, ...otherInline] = first.content;
    if (typeof firstText?.text !== "string") {
      return [...item.content];
    }
    const stripped = firstText.text.replace(TASK_MARKER, "");
    const inline =
      stripped.length > 0
        ? [this.schema.text(stripped, firstText.marks), ...otherInline]
        : otherInline;
    return [this.schema.node(first.type, first.attrs, inline), ...rest];
  }

  /**
   * The image attributes for an inline token that contains nothing but a single
   * image, or `null` when it is anything else — including when the schema has no
   * image node, so a schema without media simply never takes this path.
   */
  private standaloneImageAttrs(token: MarkdownToken): Record<string, unknown> | null {
    const children = token.children ?? [];
    const only = children.length === 1 ? children[0] : undefined;
    if (only?.type !== "image" || !this.hasNodeType(this.spec.nodes.image)) {
      return null;
    }

    const src = only.attrGet("src") ?? "";
    // An unsafe source must not become a node the view will try to load. There
    // is no usable image here, so the caller falls back to the inline path,
    // where the alt text survives as plain text.
    if (!isSafeMediaUrl(src)) {
      return null;
    }

    return {
      [this.spec.srcAttr]: src,
      [this.spec.altAttr]: only.content,
      [this.spec.titleAttr]: only.attrGet("title") ?? "",
    };
  }

  private hasNodeType(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.schema.spec.nodes, name);
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
        case "image": {
          // An image sharing a line with text: the block-level image node can't
          // go here, so it degrades to a link — the same shape the exporter
          // uses for media Markdown can't express, and the reference survives.
          const src = token.attrGet("src") ?? "";
          if (isSafeMediaUrl(src)) {
            push(
              token.content || src,
              this.schema.mark(marks.link as MarkName, {
                [this.spec.hrefAttr]: src,
              }),
            );
          } else {
            push(token.content);
          }
          break;
        }
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

/** `[ ] ` or `[x] ` at the very start of an item's text. */
const TASK_MARKER = /^\[([ xX])\]\s+/;

/** Whether a list item starts with a task marker, and whether it is checked. */
function readTaskMarker(item: {
  readonly content: readonly { readonly content: readonly { readonly text?: string }[] }[];
}): { readonly checked: boolean } | null {
  const text = item.content[0]?.content[0]?.text;
  const match = typeof text === "string" ? TASK_MARKER.exec(text) : null;
  return match ? { checked: (match[1] ?? " ").toLowerCase() === "x" } : null;
}
