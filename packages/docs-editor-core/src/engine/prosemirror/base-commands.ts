import {
  baseKeymap as proseMirrorBaseKeymap,
  createParagraphNear as proseMirrorCreateParagraphNear,
  joinBackward as proseMirrorJoinBackward,
  joinDown as proseMirrorJoinDown,
  joinForward as proseMirrorJoinForward,
  joinUp as proseMirrorJoinUp,
  liftEmptyBlock as proseMirrorLiftEmptyBlock,
  selectNodeBackward as proseMirrorSelectNodeBackward,
  selectNodeForward as proseMirrorSelectNodeForward,
  selectParentNode as proseMirrorSelectParentNode,
  splitBlock as proseMirrorSplitBlock,
} from "prosemirror-commands";

import type { EngineState, EngineTransaction } from "./state";

type EngineDispatch = (transaction: EngineTransaction) => void;

/** An engine-level command: reports applicability and, given `dispatch`, performs its edit. */
export type EngineCommand = (state: EngineState, dispatch?: EngineDispatch) => boolean;

/**
 * The remaining first-party `prosemirror-commands` that make a text editor
 * behave like one — splitting on Enter, joining/deleting at block boundaries,
 * lifting empty blocks, etc. Wrapped for the same reason as every other
 * `prosemirror-commands` binding: re-implementing the boundary/edge-case logic
 * (what joins into what, when a paragraph is created near an atom) would mean
 * re-solving problems PM's own team already has.
 */

export function runEngineSplitBlock(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorSplitBlock(state, dispatch);
}

export function runEngineJoinBackward(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorJoinBackward(state, dispatch);
}

export function runEngineJoinForward(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorJoinForward(state, dispatch);
}

export function runEngineJoinUp(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorJoinUp(state, dispatch);
}

export function runEngineJoinDown(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorJoinDown(state, dispatch);
}

export function runEngineLiftEmptyBlock(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorLiftEmptyBlock(state, dispatch);
}

export function runEngineCreateParagraphNear(
  state: EngineState,
  dispatch?: EngineDispatch,
): boolean {
  return proseMirrorCreateParagraphNear(state, dispatch);
}

export function runEngineSelectNodeBackward(
  state: EngineState,
  dispatch?: EngineDispatch,
): boolean {
  return proseMirrorSelectNodeBackward(state, dispatch);
}

export function runEngineSelectNodeForward(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorSelectNodeForward(state, dispatch);
}

export function runEngineSelectParentNode(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorSelectParentNode(state, dispatch);
}

/**
 * `prosemirror-commands`' own platform-appropriate base keymap (Enter,
 * Backspace, Delete, Mod-a, …) — the exact, cross-platform, well-tested
 * bindings, as engine-level commands keyed by key string. `src/commands/`
 * adapts each into a docs-editor `Command`.
 */
export function getEngineBaseKeymap(): Readonly<Record<string, EngineCommand>> {
  return proseMirrorBaseKeymap;
}
