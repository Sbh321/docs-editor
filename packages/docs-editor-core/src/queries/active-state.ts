import { engineActiveBlock, engineActiveMarks } from "../engine";

import type { Mark } from "../schema";
import type { EditorState } from "../state";

/** The type and attributes of the textblock the selection currently sits in. */
export interface ActiveBlock<NodeName extends string = string> {
  readonly type: NodeName;
  readonly attrs: Record<string, unknown>;
}

/**
 * Whether every entry in `expected` is present, with an equal value, in
 * `actual` — a subset match, so callers can ask "is this a heading of level
 * 2" without spelling out every attribute the node carries.
 */
function attributesMatch(
  actual: Readonly<Record<string, unknown>>,
  expected: Readonly<Record<string, unknown>>,
): boolean {
  return Object.entries(expected).every(([key, value]) => Object.is(actual[key], value));
}

/**
 * The marks active for the current selection — what a toolbar renders as
 * "pressed". At a collapsed cursor these are the marks that would apply to the
 * next typed character; over a range, only the marks covering the entire
 * selection (a half-bold selection reports no active bold).
 *
 * A query, never an edit: unlike a {@link import("../commands").Command} dry
 * run (which answers "can this apply here?"), this answers "is this already
 * applied here?". Toolbar buttons typically need both.
 */
export function activeMarks<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
): readonly Mark<MarkName>[] {
  // The engine returns type-erased `Mark<string>`s; every mark it produces
  // comes from this state's own schema, so narrowing to `MarkName` is sound.
  return engineActiveMarks(state.engine) as unknown as readonly Mark<MarkName>[];
}

/**
 * Whether a mark of type `markType` is {@link activeMarks active} for the
 * current selection. When `attrs` is given, only a mark whose attributes
 * match every provided entry counts (e.g. a link with a specific `href`);
 * omit `attrs` to match the mark type regardless of its attributes.
 */
export function isMarkActive<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  markType: MarkName,
  attrs?: Readonly<Record<string, unknown>>,
): boolean {
  return activeMarks(state).some(
    (mark) => mark.type === markType && (attrs === undefined || attributesMatch(mark.attrs, attrs)),
  );
}

/**
 * The {@link ActiveBlock type and attributes} of the textblock containing the
 * selection's start — e.g. `{ type: "heading", attrs: { level: 2 } }`. Reads
 * the node directly containing the resolved start position, so a cursor inside
 * a paragraph reports the paragraph, inside a heading reports the heading.
 */
export function activeBlockType<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
): ActiveBlock<NodeName> {
  const block = engineActiveBlock(state.engine);
  return { type: block.type as NodeName, attrs: block.attrs };
}

/**
 * Whether the {@link activeBlockType active block} is of type `nodeType`.
 * When `attrs` is given, only a block whose attributes match every provided
 * entry counts (e.g. `isBlockActive(state, "heading", { level: 2 })`); omit
 * `attrs` to match the type regardless of its attributes.
 */
export function isBlockActive<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  nodeType: NodeName,
  attrs?: Readonly<Record<string, unknown>>,
): boolean {
  const block = activeBlockType(state);
  return block.type === nodeType && (attrs === undefined || attributesMatch(block.attrs, attrs));
}
