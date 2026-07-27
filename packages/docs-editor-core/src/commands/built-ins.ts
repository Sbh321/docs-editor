import {
  runEngineDeleteSelection,
  runEngineExitCode,
  runEngineLift,
  runEngineNewlineInCode,
  runEngineRemoveFormatting,
  runEngineSelectAll,
  runEngineSetBlockType,
  runEngineSetMark,
  runEngineToggleMark,
  runEngineWrapIn,
} from "../engine";

import { adaptDispatch } from "./adapt-dispatch";

import type { EditorState } from "../state";
import type { Dispatch } from "./types";

/**
 * These wrap `prosemirror-commands` (via `../engine`) rather than
 * reimplementing "does this range already have this mark" / "what happens
 * at an empty selection" ourselves — see `src/engine/prosemirror/commands.ts`.
 * The remaining structural command (split — needed for lists) is deferred
 * until that node type exists to define it against.
 */

/**
 * Deletes the current selection. Reports `false` when the selection is
 * empty. Declared as a generic function (not a fixed `Command`-typed value)
 * so that calling it with a specifically-typed `EditorState<N, M>` narrows
 * the `dispatch` callback's `Transaction` type to match — a plain
 * `Command`-typed value would pin the callback to `Transaction<string>`
 * regardless of the caller's actual state type.
 */
export function deleteSelection<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineDeleteSelection(state.engine, adaptDispatch(dispatch));
}

/** Selects the entire document. See {@link deleteSelection} for why this is generic. */
export function selectAll<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineSelectAll(state.engine, adaptDispatch(dispatch));
}

/**
 * Lifts the selected block (or its closest liftable ancestor, e.g. a
 * paragraph inside a blockquote) out of its parent node. Reports `false`
 * when nothing in the selection can be lifted. See {@link deleteSelection}
 * for why this is generic.
 */
export function lift<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineLift(state.engine, adaptDispatch(dispatch));
}

/**
 * Inside a node declared `code: true` (e.g. a code block), replaces the
 * selection with a newline character instead of splitting into a new block.
 * Reports `false` outside such a node. See {@link deleteSelection} for why
 * this is generic.
 */
export function newlineInCode<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineNewlineInCode(state.engine, adaptDispatch(dispatch));
}

/**
 * Inside a node declared `code: true`, creates a default block after it and
 * moves the cursor there — the deliberate "leave the code block" action,
 * since {@link newlineInCode} makes Enter alone insert a newline instead.
 */
export function exitCode<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  return runEngineExitCode(state.engine, adaptDispatch(dispatch));
}

/**
 * Toggles `markType` over the current selection: removes it if the whole
 * selection already carries it, otherwise adds it. At a collapsed cursor,
 * toggles it in the "marks for the next inserted character" set instead of
 * touching any range.
 *
 * `markType` takes a plain `string` rather than a schema-specific `MarkName`
 * literal: at the point `toggleMark("bold")` is called, the target editor's
 * `EditorState<NodeName, MarkName>` isn't known yet, so there's no concrete
 * `MarkName` union to check `markType` against. The returned function is
 * generic over both `NodeName` and `MarkName`, inferred fresh from whichever
 * state it's actually called with; `Schema.mark()` still validates `markType`
 * against that state's real schema at call time, throwing `UnknownMarkTypeError`
 * for a genuinely invalid name.
 */
/**
 * Removes every mark from the current selection — the "clear formatting"
 * action. Reports `false` when the selection is empty (there's no range to
 * clear). See {@link deleteSelection} for why this is generic.
 */
export function removeFormatting<
  NodeName extends string = string,
  MarkName extends string = string,
>(state: EditorState<NodeName, MarkName>, dispatch?: Dispatch<NodeName>): boolean {
  return runEngineRemoveFormatting(state.engine, adaptDispatch(dispatch));
}

export function toggleMark(markType: string, attrs?: Record<string, unknown>) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const mark = state.schema.mark(markType as MarkName, attrs);
    return runEngineToggleMark(state.engine, mark.type, mark.attrs, adaptDispatch(dispatch));
  };
}

/**
 * Sets the mark `markType` to a specific value over the selection, replacing
 * any existing mark of the same type — the "choose a value" counterpart to
 * {@link toggleMark}'s on/off. Use it for attribute-carrying marks whose value
 * changes rather than toggles: a font family, font size, or text color. At a
 * collapsed cursor it updates the stored marks so the next typed text carries
 * the value.
 *
 * See {@link toggleMark} for why `markType` is a plain `string` and the returned
 * function is generic; `Schema.mark()` validates `markType`/`attrs` against the
 * real schema at call time.
 */
export function setMark(markType: string, attrs?: Record<string, unknown>) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const mark = state.schema.mark(markType as MarkName, attrs);
    return runEngineSetMark(state.engine, mark.type, mark.attrs, adaptDispatch(dispatch));
  };
}

/**
 * Changes the block type of every textblock touched by the current
 * selection to `nodeType` (e.g. toggling a paragraph to a heading and back).
 * See {@link toggleMark} for why `nodeType` is a plain `string` and the
 * returned function is generic.
 */
export function setBlockType(nodeType: string, attrs?: Record<string, unknown>) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const blockType = state.schema.blockType(nodeType as NodeName, attrs);
    return runEngineSetBlockType(
      state.engine,
      blockType.type,
      blockType.attrs,
      adaptDispatch(dispatch),
    );
  };
}

/**
 * Wraps the textblocks touched by the current selection in a new `nodeType`
 * container (e.g. wrapping paragraphs in a blockquote). Reports `false` when
 * the selection can't be wrapped this way. See {@link toggleMark} for why
 * `nodeType` is a plain `string` and the returned function is generic; see
 * {@link lift} for the inverse.
 */
export function wrapIn(nodeType: string, attrs?: Record<string, unknown>) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const blockType = state.schema.blockType(nodeType as NodeName, attrs);
    return runEngineWrapIn(state.engine, blockType.type, blockType.attrs, adaptDispatch(dispatch));
  };
}
