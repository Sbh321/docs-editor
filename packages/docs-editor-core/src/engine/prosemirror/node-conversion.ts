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
 * Converts a `prosemirror-model` node back into a {@link DocumentNode}.
 * ProseMirror's own `toJSON()` omits `attrs`/`content`/`marks` when they're
 * empty; this backfills them so the result always satisfies docs-editor's
 * `DocumentNode` shape, and deep-freezes it to match {@link Schema}'s own
 * immutability guarantee.
 */
export function fromEngineNode<NodeName extends string = string>(
  node: ProseMirrorNode,
): DocumentNode<NodeName> {
  return normalizeNode(node.toJSON()) as DocumentNode<NodeName>;
}

function normalizeNode(json: unknown): DocumentNode {
  if (!isPlainObject(json) || typeof json.type !== "string") {
    throw new EngineConversionError(
      'Expected a ProseMirror node\'s JSON representation to be an object with a string "type".',
    );
  }

  const attrs = isPlainObject(json.attrs) ? json.attrs : {};
  const marks = Array.isArray(json.marks) ? json.marks.map(normalizeMark) : [];

  if (typeof json.text === "string") {
    return Object.freeze({
      type: json.type,
      attrs: Object.freeze({ ...attrs }),
      content: Object.freeze([]),
      marks: Object.freeze(marks),
      text: json.text,
    });
  }

  const content = Array.isArray(json.content) ? json.content.map(normalizeNode) : [];

  return Object.freeze({
    type: json.type,
    attrs: Object.freeze({ ...attrs }),
    content: Object.freeze(content),
    marks: Object.freeze(marks),
  });
}

/** Converts a `prosemirror-model` mark back into a docs-editor {@link Mark}. */
export function fromEngineMark<MarkName extends string = string>(
  mark: ProseMirrorMark,
): Mark<MarkName> {
  return normalizeMark(mark.toJSON()) as Mark<MarkName>;
}

function normalizeMark(json: unknown): Mark {
  if (!isPlainObject(json) || typeof json.type !== "string") {
    throw new EngineConversionError(
      'Expected a ProseMirror mark\'s JSON representation to have a string "type".',
    );
  }
  const attrs = isPlainObject(json.attrs) ? json.attrs : {};
  return Object.freeze({ type: json.type, attrs: Object.freeze({ ...attrs }) });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
