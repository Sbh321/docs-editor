import { isTextNode } from "@sbh321/docs-editor-core";

import { resolveMarkdownSpec } from "./spec";

import type { MarkdownSpec } from "./spec";
import type { DocumentExporter, DocumentNode, Mark } from "@sbh321/docs-editor-core";

/**
 * Serializes a {@link DocumentNode} to Markdown by walking the plain document
 * tree — no ProseMirror involved, so this package never touches the engine.
 *
 * Markdown is intentionally lossy: only what Markdown can express survives
 * (headings, paragraphs, blockquotes, bullet/ordered lists, code blocks,
 * horizontal rules, and the bold/italic/inline-code/link marks). Anything else
 * a schema models degrades — nodes render their text, unknown marks are dropped.
 */
export class MarkdownExporter<
  NodeName extends string = string,
> implements DocumentExporter<NodeName> {
  readonly format = "markdown";
  private readonly spec: MarkdownSpec;

  constructor(spec?: Parameters<typeof resolveMarkdownSpec>[0]) {
    this.spec = resolveMarkdownSpec(spec);
  }

  serialize(doc: DocumentNode<NodeName>): string {
    return serializeBlocks(doc.content, this.spec, "").replace(/\n+$/, "") + "\n";
  }
}

/** Serializes a sequence of block nodes, joined by blank lines, each line prefixed with `prefix`. */
function serializeBlocks(
  nodes: readonly DocumentNode[],
  spec: MarkdownSpec,
  prefix: string,
): string {
  return nodes.map((node) => serializeBlock(node, spec, prefix)).join("\n\n");
}

function serializeBlock(node: DocumentNode, spec: MarkdownSpec, prefix: string): string {
  const { nodes } = spec;

  switch (node.type) {
    case nodes.heading: {
      const level = typeof node.attrs[spec.levelAttr] === "number" ? node.attrs[spec.levelAttr] : 1;
      return withPrefix(
        `${"#".repeat(Math.min(6, Math.max(1, level as number)))} ${serializeInline(node, spec)}`,
        prefix,
      );
    }
    case nodes.paragraph:
      return withPrefix(serializeInline(node, spec), prefix);
    case nodes.blockquote:
      return serializeBlocks(node.content, spec, `${prefix}> `);
    case nodes.codeBlock: {
      const code = node.content.map((child) => (isTextNode(child) ? child.text : "")).join("");
      return withPrefix(`\`\`\`\n${code}\n\`\`\``, prefix);
    }
    case nodes.horizontalRule:
      return withPrefix("---", prefix);
    case nodes.bulletList:
      return serializeList(node, spec, prefix, () => "- ");
    case nodes.orderedList:
      return serializeList(node, spec, prefix, (index) => `${index + 1}. `);
    default:
      // Unknown block: fall back to its inline text so nothing is silently lost.
      return withPrefix(serializeInline(node, spec), prefix);
  }
}

function serializeList(
  node: DocumentNode,
  spec: MarkdownSpec,
  prefix: string,
  marker: (index: number) => string,
): string {
  return node.content
    .map((item, index) => {
      const bullet = marker(index);
      const indent = " ".repeat(bullet.length);
      // The item's first block starts after the bullet; continuation lines are
      // indented to align under it.
      const body = serializeBlocks(item.content, spec, "");
      const [first, ...rest] = body.split("\n");
      const firstLine = `${prefix}${bullet}${first ?? ""}`;
      const restLines = rest.map((line) => `${prefix}${indent}${line}`);
      return [firstLine, ...restLines].join("\n");
    })
    .join("\n");
}

/** Serializes a block's inline content (text runs with their marks). */
function serializeInline(node: DocumentNode, spec: MarkdownSpec): string {
  return node.content.map((child) => serializeTextNode(child, spec)).join("");
}

function serializeTextNode(node: DocumentNode, spec: MarkdownSpec): string {
  if (!isTextNode(node)) {
    // A non-text inline node (none in the common set) — emit its text content.
    return node.content.map((child) => serializeTextNode(child, spec)).join("");
  }

  const markTypes = new Set(node.marks.map((mark) => mark.type));
  const isCode = markTypes.has(spec.marks.code);

  let text = isCode ? `\`${node.text}\`` : escapeMarkdown(node.text);
  if (!isCode) {
    if (markTypes.has(spec.marks.italic)) {
      text = `*${text}*`;
    }
    if (markTypes.has(spec.marks.bold)) {
      text = `**${text}**`;
    }
  }
  if (markTypes.has(spec.marks.link)) {
    const link = node.marks.find((mark) => mark.type === spec.marks.link);
    text = `[${text}](${hrefOf(link, spec)})`;
  }
  return text;
}

function hrefOf(mark: Mark | undefined, spec: MarkdownSpec): string {
  const href = mark?.attrs[spec.hrefAttr];
  return typeof href === "string" ? href : "";
}

function withPrefix(text: string, prefix: string): string {
  if (prefix === "") {
    return text;
  }
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

/** Backslash-escapes the Markdown special characters that could trigger unwanted formatting. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]]/g, "\\$&");
}
