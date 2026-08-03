import { Node as ProseMirrorNode } from "prosemirror-model";

import { EngineConversionError } from "../errors";

import type { DocumentNode, Mark } from "../../schema";
import type { Mark as ProseMirrorMark, Schema as ProseMirrorSchema } from "prosemirror-model";

/**
 * Converts a validated {@link DocumentNode} into a `prosemirror-model` node.
 * Delegates to ProseMirror's own `Node.fromJSON`, since a docs-editor
 * `DocumentNode` is already plain, JSON-safe data in (a superset of) the
 * shape ProseMirror expects.
 */
export function toEngineNode<NodeName extends string>(
  engineSchema: ProseMirrorSchema,
  node: DocumentNode<NodeName>,
): ProseMirrorNode {
  try {
    return ProseMirrorNode.fromJSON(engineSchema, node);
  } catch (cause) {
    throw new EngineConversionError(
      `Failed to convert node of type "${node.type}" to the ProseMirror engine: ${messageOf(cause)}`,
      { cause },
    );
  }
}

/**
 * Conversion caches, keyed by the engine's own immutable node/mark objects.
 *
 * ProseMirror documents are persistent data structures: applying a transaction
 * produces a new root but **reuses the very same child node objects** for every
 * subtree the change didn't touch. Because those objects never mutate, a node
 * always converts to the same `DocumentNode` — so caching by identity is sound,
 * and converting the document after an edit only does real work along the
 * changed path. That turns conversion from O(document) into O(change), which is
 * what keeps typing latency flat as documents grow (ROADMAP Phase 6, Milestone
 * 6.2; see docs/PERFORMANCE.md).
 *
 * `WeakMap` means entries disappear with the engine nodes themselves, so this
 * cannot retain a document that the editor has moved past.
 */
const nodeConversionCache = new WeakMap<ProseMirrorNode, DocumentNode>();
const markConversionCache = new WeakMap<ProseMirrorMark, Mark>();

/** Shared empty collections — every childless or unmarked node can point at the same frozen instances. */
const EMPTY_CONTENT: readonly DocumentNode[] = Object.freeze([]);
const EMPTY_MARKS: readonly Mark[] = Object.freeze([]);

/**
 * Converts a `prosemirror-model` node back into a {@link DocumentNode}.
 *
 * Walks the engine node directly rather than going through its `toJSON()` (which
 * would allocate an intermediate JSON tree for the whole document, then a second
 * normalized tree), backfills the `attrs`/`content`/`marks` that ProseMirror
 * omits when empty, and deep-freezes the result to match {@link Schema}'s own
 * immutability guarantee.
 *
 * Results are memoized per engine node (see the cache note above), so repeated
 * conversions of an unchanged subtree are free and return the identical object —
 * which also lets consumers treat `state.doc` identity as a valid change signal.
 */
export function fromEngineNode<NodeName extends string = string>(
  node: ProseMirrorNode,
): DocumentNode<NodeName> {
  return convertNode(node) as DocumentNode<NodeName>;
}

function convertNode(node: ProseMirrorNode): DocumentNode {
  const cached = nodeConversionCache.get(node);
  if (cached) {
    return cached;
  }

  const converted = node.isText ? convertTextNode(node) : convertParentNode(node);
  nodeConversionCache.set(node, converted);
  return converted;
}

function convertTextNode(node: ProseMirrorNode): DocumentNode {
  return Object.freeze({
    type: node.type.name,
    attrs: freezeAttrs(node.attrs),
    content: EMPTY_CONTENT,
    marks: convertMarks(node.marks),
    // A ProseMirror text node always carries text; the fallback keeps the
    // `DocumentNode` shape total rather than trusting that invariant silently.
    text: node.text ?? "",
  });
}

function convertParentNode(node: ProseMirrorNode): DocumentNode {
  const childCount = node.childCount;
  if (childCount === 0) {
    return Object.freeze({
      type: node.type.name,
      attrs: freezeAttrs(node.attrs),
      content: EMPTY_CONTENT,
      marks: convertMarks(node.marks),
    });
  }

  const content: DocumentNode[] = new Array<DocumentNode>(childCount);
  for (let index = 0; index < childCount; index += 1) {
    content[index] = convertNode(node.child(index));
  }

  return Object.freeze({
    type: node.type.name,
    attrs: freezeAttrs(node.attrs),
    content: Object.freeze(content),
    marks: convertMarks(node.marks),
  });
}

/** Converts a `prosemirror-model` mark back into a docs-editor {@link Mark}. */
export function fromEngineMark<MarkName extends string = string>(
  mark: ProseMirrorMark,
): Mark<MarkName> {
  return convertMark(mark) as Mark<MarkName>;
}

function convertMark(mark: ProseMirrorMark): Mark {
  const cached = markConversionCache.get(mark);
  if (cached) {
    return cached;
  }
  const converted = Object.freeze({ type: mark.type.name, attrs: freezeAttrs(mark.attrs) });
  markConversionCache.set(mark, converted);
  return converted;
}

function convertMarks(marks: readonly ProseMirrorMark[]): readonly Mark[] {
  if (marks.length === 0) {
    return EMPTY_MARKS;
  }
  return Object.freeze(marks.map(convertMark));
}

function freezeAttrs(attrs: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return Object.freeze({ ...(attrs ?? {}) });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
