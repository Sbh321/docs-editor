import { isSafeMediaUrl, isTextNode } from "@sbh321/docs-editor-core";

import { resolveMarkdownSpec } from "./spec";

import type { MarkdownSpec } from "./spec";
import type { DocumentExporter, DocumentNode, Mark } from "@sbh321/docs-editor-core";

/**
 * Serializes a {@link DocumentNode} to Markdown by walking the plain document
 * tree — no ProseMirror involved, so this package never touches the engine.
 *
 * Markdown is intentionally lossy: only what Markdown can express survives
 * (headings, paragraphs, blockquotes, bullet/ordered lists, code blocks,
 * horizontal rules, images, and the bold/italic/inline-code/link marks).
 * Anything else a schema models degrades — nodes render their text, unknown
 * marks are dropped.
 *
 * Media (ROADMAP Phase 7, Milestone 7.6) degrades *predictably* rather than
 * silently: only `image` is native to Markdown, so video, audio, attachments and
 * embeds become ordinary links. That keeps the one thing Markdown can still
 * carry — the reference to the media — instead of dropping the node and leaving
 * a hole. See the package README for the full table.
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
  return (
    nodes
      .map((node) => serializeBlock(node, spec, prefix))
      // A block can legitimately produce nothing — an image still uploading has no
      // URL and no alt text yet. Dropping those here keeps the blank-line join
      // from opening a run of empty lines in the middle of the document.
      .filter((block) => block.length > 0)
      .join("\n\n")
  );
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
    case nodes.taskList:
      // GitHub Flavored Markdown's checklist syntax. Not CommonMark, but it is
      // what the tools a document travels through actually read.
      return serializeList(node, spec, prefix, (_index, item) =>
        item?.attrs[spec.checkedAttr] === true ? "- [x] " : "- [ ] ",
      );
    case nodes.image:
      return withPrefix(serializeImage(node, spec), prefix);
    case nodes.video:
    case nodes.audio:
    case nodes.file:
    case nodes.embed:
      return withPrefix(serializeMediaLink(node, spec), prefix);
    case nodes.figure:
      return serializeFigure(node, spec, prefix);
    case nodes.caption:
      return withPrefix(serializeInline(node, spec), prefix);
    default:
      // Unknown block: fall back to its inline text so nothing is silently lost.
      return withPrefix(serializeInline(node, spec), prefix);
  }
}

function serializeList(
  node: DocumentNode,
  spec: MarkdownSpec,
  prefix: string,
  marker: (index: number, item?: DocumentNode) => string,
): string {
  return node.content
    .map((item, index) => {
      const bullet = marker(index, item);
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

/**
 * `![alt](src "title")` — the one media form Markdown expresses natively.
 *
 * An empty alt is emitted as-is rather than substituted: `![](src)` is
 * Markdown's way of saying "this image has no alternative text", which is
 * exactly what a decorative image means.
 */
function serializeImage(node: DocumentNode, spec: MarkdownSpec): string {
  const src = mediaSource(node, spec);
  if (src === null) {
    // No usable URL — still uploading, or the source failed the safety check.
    // Keep whatever text describes it so the author sees the gap.
    return escapeMarkdown(mediaLabel(node, spec));
  }
  const alt = attrString(node, spec.altAttr);
  return `![${escapeMarkdown(alt)}](${linkDestination(src)}${linkTitle(node, spec)})`;
}

/**
 * Video, audio, attachments and embeds have no Markdown syntax, so they become
 * ordinary links.
 *
 * A link is the honest degradation: it is the only construct that still carries
 * the media's location, so the document stays usable and re-importable rather
 * than losing the reference entirely. The link text is drawn from the document
 * (filename, alt, title, else the URL) rather than an invented English word
 * like "Video" — a serializer has no business inventing prose in one language.
 */
function serializeMediaLink(node: DocumentNode, spec: MarkdownSpec): string {
  const src = mediaSource(node, spec);
  const label = mediaLabel(node, spec);
  if (src === null) {
    return escapeMarkdown(label);
  }
  return `[${escapeMarkdown(label === "" ? src : label)}](${linkDestination(src)}${linkTitle(node, spec)})`;
}

/**
 * Markdown has no figure/caption pairing, so the two are emitted as consecutive
 * blocks: the media, then the caption as its own paragraph. The grouping is
 * lost; both halves survive.
 */
function serializeFigure(node: DocumentNode, spec: MarkdownSpec, prefix: string): string {
  return serializeBlocks(node.content, spec, prefix);
}

/**
 * A media node's source, or `null` when there is nothing safe to link to.
 *
 * The check matters because Markdown output is frequently rendered back to HTML
 * by something else — emitting `[x](javascript:…)` would hand that renderer a
 * live anchor. `src` is also empty by design while an upload is in flight.
 */
function mediaSource(node: DocumentNode, spec: MarkdownSpec): string | null {
  const src = attrString(node, spec.srcAttr);
  return src !== "" && isSafeMediaUrl(src) ? src : null;
}

/** The most descriptive text the node carries, or `""` when it carries none. */
function mediaLabel(node: DocumentNode, spec: MarkdownSpec): string {
  return (
    attrString(node, spec.filenameAttr) ||
    attrString(node, spec.altAttr) ||
    attrString(node, spec.titleAttr)
  );
}

function attrString(node: DocumentNode, name: string): string {
  const value = node.attrs[name];
  return typeof value === "string" ? value : "";
}

/** ` "title"` when the node has one, else `""`. */
function linkTitle(node: DocumentNode, spec: MarkdownSpec): string {
  const title = attrString(node, spec.titleAttr);
  return title === "" ? "" : ` "${title.replace(/["\\]/g, "\\$&")}"`;
}

/**
 * Escapes a URL for a link destination. Whitespace and angle brackets force the
 * `<…>` form, which is the only way Markdown accepts a URL containing spaces.
 */
function linkDestination(url: string): string {
  if (/[\s<>]/.test(url)) {
    return `<${url.replace(/[<>\\]/g, "\\$&")}>`;
  }
  return url.replace(/[()\\]/g, "\\$&");
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
