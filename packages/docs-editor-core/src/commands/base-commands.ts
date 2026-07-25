import {
  getEngineBaseKeymap,
  runEngineCreateParagraphNear,
  runEngineJoinBackward,
  runEngineJoinDown,
  runEngineJoinForward,
  runEngineJoinUp,
  runEngineLiftEmptyBlock,
  runEngineSelectNodeBackward,
  runEngineSelectNodeForward,
  runEngineSelectParentNode,
  runEngineSplitBlock,
} from "../engine";

import { adaptDispatch } from "./adapt-dispatch";

import type { EditorState } from "../state";
import type { Command, Dispatch } from "./types";

/**
 * The core editing commands that make the editor behave like a text editor:
 * splitting a block on Enter, joining/deleting across block boundaries, lifting
 * empty blocks, and selecting nodes/parents. Each wraps its `prosemirror-
 * commands` counterpart via `../engine`. See {@link deleteSelection} in
 * `built-ins.ts` for why these are declared as generic functions.
 *
 * Most consumers won't call these directly — they come pre-bound in
 * {@link baseKeymap}. They're exported individually for building custom keymaps.
 */

/** Splits the textblock at the cursor into two (the default Enter behavior). */
export function splitBlock<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineSplitBlock(state.engine, adaptDispatch(dispatch));
}

/**
 * At the start of a textblock, joins it into the block before it (the structural
 * part of Backspace). Reports `false` when there's nothing to join backward into.
 */
export function joinBackward<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineJoinBackward(state.engine, adaptDispatch(dispatch));
}

/** At the end of a textblock, joins the following block into it (the structural part of Delete). */
export function joinForward<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineJoinForward(state.engine, adaptDispatch(dispatch));
}

/** Joins the selected block (or the one at the cursor) with the block above it. */
export function joinUp<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineJoinUp(state.engine, adaptDispatch(dispatch));
}

/** Joins the selected block (or the one at the cursor) with the block below it. */
export function joinDown<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineJoinDown(state.engine, adaptDispatch(dispatch));
}

/**
 * In an empty textblock inside a container (e.g. a list item or blockquote),
 * lifts it out of the container — the "press Enter on an empty list item to
 * leave the list" behavior. Reports `false` when the block isn't empty or can't
 * be lifted.
 */
export function liftEmptyBlock<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineLiftEmptyBlock(state.engine, adaptDispatch(dispatch));
}

/**
 * When a selectable (atom) node is selected, or the cursor is next to one,
 * creates a default textblock next to it — so you can type after an image or
 * divider. Reports `false` when it doesn't apply.
 */
export function createParagraphNear<
  NodeName extends string = string,
  MarkName extends string = string,
>(state: EditorState<NodeName, MarkName>, dispatch?: Dispatch<NodeName>): boolean {
  return runEngineCreateParagraphNear(state.engine, adaptDispatch(dispatch));
}

/**
 * At the start of a textblock preceded by an atom node, selects that node
 * (rather than deleting into it) — the "Backspace next to an image selects the
 * image" behavior, which pairs with {@link import("./types").Command node
 * selection}. Reports `false` when it doesn't apply.
 */
export function selectNodeBackward<
  NodeName extends string = string,
  MarkName extends string = string,
>(state: EditorState<NodeName, MarkName>, dispatch?: Dispatch<NodeName>): boolean {
  return runEngineSelectNodeBackward(state.engine, adaptDispatch(dispatch));
}

/** The {@link selectNodeBackward} counterpart for Delete at the end of a textblock. */
export function selectNodeForward<
  NodeName extends string = string,
  MarkName extends string = string,
>(state: EditorState<NodeName, MarkName>, dispatch?: Dispatch<NodeName>): boolean {
  return runEngineSelectNodeForward(state.engine, adaptDispatch(dispatch));
}

/** Selects the parent node of the current selection (Escape's default). Reports `false` at the top level. */
export function selectParentNode<
  NodeName extends string = string,
  MarkName extends string = string,
>(state: EditorState<NodeName, MarkName>, dispatch?: Dispatch<NodeName>): boolean {
  return runEngineSelectParentNode(state.engine, adaptDispatch(dispatch));
}

/**
 * A ready-made keymap of the essential editing bindings — `prosemirror-
 * commands`' own platform-appropriate base keymap (Enter to split,
 * Backspace/Delete to join or delete, Mod-a to select all, Escape to select the
 * parent, …), exposed as docs-editor `Command`s. Spread it into an
 * `<Editor keymap>` (or `EditorView` `keymap`) to get a working editor from one
 * line, layering your own bindings on top:
 *
 * ```ts
 * keymap={{ ...baseKeymap, "Mod-b": toggleMark("bold"), Enter: chainCommands(newlineInCode, splitListItem("list_item"), baseKeymap.Enter!) }}
 * ```
 *
 * Frozen so it can be safely shared and spread.
 */
export const baseKeymap: Readonly<Record<string, Command>> = buildBaseKeymap();

function buildBaseKeymap(): Readonly<Record<string, Command>> {
  const engineKeymap = getEngineBaseKeymap();
  const keymap: Record<string, Command> = {};
  for (const [key, engineCommand] of Object.entries(engineKeymap)) {
    keymap[key] = (state, dispatch) => engineCommand(state.engine, adaptDispatch(dispatch));
  }
  return Object.freeze(keymap);
}
