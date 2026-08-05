/**
 * Media accessibility auditing (ROADMAP Phase 7 — Media, Milestone 7.8).
 *
 * CLAUDE.md treats accessibility regressions as bugs, and the roadmap makes
 * alt text a *gate* rather than a nicety. A gate needs something to check
 * against, so this reports the document's accessibility problems as data —
 * letting an application block a publish, badge the offending node, or fail a
 * test, rather than each one re-deriving the rules.
 *
 * It lives in the core because it is a property of the **document model**, not
 * of any rendering of it: the same answer must hold for a headless export as
 * for an on-screen editor.
 */

import { nodeSize } from "../schema";

import { MEDIA_ATTRS, MEDIA_NODE_TYPES } from "./media-types";

import type { DocumentNode, Schema } from "../schema";

/** Why a media node fails an accessibility check. */
export type MediaAccessibilityIssueKind =
  /**
   * An image carries neither alternative text nor an explicit decorative mark,
   * so assistive technology has nothing to announce and no reason to skip it.
   */
  | "missing-alt-text"
  /**
   * An embed has no title. Screen readers announce an untitled frame as
   * "frame", which tells the user nothing about whether to enter it.
   */
  | "missing-embed-title"
  /**
   * A media node is marked decorative *and* carries alternative text. The two
   * contradict each other, and which one wins is a renderer detail the author
   * should not have to know.
   */
  | "decorative-with-alt-text";

/** One accessibility problem found in a document. */
export interface MediaAccessibilityIssue {
  readonly kind: MediaAccessibilityIssueKind;
  /** The offending node's type name. */
  readonly nodeType: string;
  /** Its document position, suitable for selecting or decorating the node. */
  readonly pos: number;
  /** A message written for the person who has to fix it. */
  readonly message: string;
}

/** Types that carry meaning and therefore need a text alternative. */
const NEEDS_ALT_TEXT = new Set(["image", "video"]);

function attrString(node: DocumentNode, name: string): string {
  const value = node.attrs[name];
  return typeof value === "string" ? value : "";
}

/**
 * Every media accessibility problem in `doc`, in document order.
 *
 * An empty array means the document passes. Note that this cannot judge whether
 * alt text is *good* — only that a deliberate choice was made. That distinction
 * is exactly why `decorative` is recorded separately from an empty `alt`: an
 * author who marked an image decorative has decided, and an author who left the
 * field blank has not.
 *
 * The `schema` is required because {@link MediaAccessibilityIssue.pos} has to be
 * a position the caller can actually select and decorate, and a document tree
 * alone does not determine positions: a *leaf* node occupies one position while
 * a node with content occupies its content plus two. Whether a type can hold
 * content is a schema fact, so computing positions without one silently
 * misplaces every issue that follows a leaf.
 *
 * ```ts
 * const issues = mediaAccessibilityIssues(state.doc, state.schema);
 * if (issues.length > 0) {
 *   // Block the publish, or decorate each `issue.pos`.
 * }
 * ```
 */
export function mediaAccessibilityIssues<
  NodeName extends string = string,
  MarkName extends string = string,
>(
  doc: DocumentNode<NodeName>,
  schema: Schema<NodeName, MarkName>,
): readonly MediaAccessibilityIssue[] {
  const issues: MediaAccessibilityIssue[] = [];

  const visit = (node: DocumentNode<NodeName>, pos: number): void => {
    if ((MEDIA_NODE_TYPES as readonly string[]).includes(node.type)) {
      collect(node, pos, issues);
    }

    // A node's own position is its opening boundary; its children start after.
    let childPos = pos + 1;
    for (const child of node.content) {
      visit(child, childPos);
      childPos += nodeSize(child, schema);
    }
  };

  let pos = 0;
  for (const child of doc.content) {
    visit(child, pos);
    pos += nodeSize(child, schema);
  }

  return issues;
}

function collect(node: DocumentNode, pos: number, issues: MediaAccessibilityIssue[]): void {
  const alt = attrString(node, MEDIA_ATTRS.alt);
  const decorative = node.attrs[MEDIA_ATTRS.decorative] === true;

  if (decorative && alt !== "") {
    issues.push({
      kind: "decorative-with-alt-text",
      nodeType: node.type,
      pos,
      message: `This ${node.type} is marked decorative but also has alt text ("${alt}"). Clear one: decorative media is hidden from assistive technology, so its alt text is never announced.`,
    });
    return;
  }

  if (NEEDS_ALT_TEXT.has(node.type) && !decorative && alt === "") {
    issues.push({
      kind: "missing-alt-text",
      nodeType: node.type,
      pos,
      message: `This ${node.type} has no alt text. Describe it for screen-reader users, or mark it decorative if it carries no meaning.`,
    });
    return;
  }

  if (node.type === "embed" && alt === "" && attrString(node, "provider") === "") {
    issues.push({
      kind: "missing-embed-title",
      nodeType: node.type,
      pos,
      message:
        "This embed has no title. Screen readers announce an untitled frame as just “frame”, which gives no reason to enter it.",
    });
  }
}
