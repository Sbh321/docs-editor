import type { Command } from "./types";

/**
 * Combines commands into one that tries each in order and stops at the
 * first one that reports success (returning `true`). Typical use: binding
 * one key to "try several commands, run whichever applies first" (e.g.
 * Backspace trying joinBackward, then deleteSelection).
 */
export function chainCommands<NodeName extends string = string, MarkName extends string = string>(
  ...commands: readonly Command<NodeName, MarkName>[]
): Command<NodeName, MarkName> {
  return (state, dispatch) => {
    for (const command of commands) {
      if (command(state, dispatch)) {
        return true;
      }
    }
    return false;
  };
}
