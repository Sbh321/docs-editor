import {
  history as proseMirrorHistory,
  redo as proseMirrorRedo,
  undo as proseMirrorUndo,
} from "prosemirror-history";

import type { EngineState, EngineTransaction } from "./state";
import type { Plugin } from "prosemirror-state";

/** Wraps `prosemirror-history`'s configuration options unchanged. */
export interface EngineHistoryOptions {
  readonly depth?: number;
  readonly newGroupDelay?: number;
}

/**
 * Builds the ProseMirror plugin that tracks undo/redo stacks. `runEngineUndo`/
 * `runEngineRedo` are safe to call even on a state that never installed this
 * plugin — `prosemirror-history` itself reports "nothing to undo" rather than
 * throwing when its plugin state is absent.
 */
export function createEngineHistoryPlugin(options?: EngineHistoryOptions): Plugin {
  return proseMirrorHistory(options);
}

type EngineDispatch = (transaction: EngineTransaction) => void;

export function runEngineUndo(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorUndo(state, dispatch);
}

export function runEngineRedo(state: EngineState, dispatch?: EngineDispatch): boolean {
  return proseMirrorRedo(state, dispatch);
}
