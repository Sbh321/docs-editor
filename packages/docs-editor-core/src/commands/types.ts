import type { EditorState, Transaction } from "../state";

/**
 * Called with the transaction a {@link Command} wants to apply. The command
 * itself never applies its own transaction — the caller (a keybinding
 * handler, a toolbar button, `CommandRegistry.run`, ...) decides whether and
 * how to apply it (e.g. `dispatch: (tr) => setState((s) => s.apply(tr)))`.
 */
export type Dispatch<NodeName extends string = string> = (
  transaction: Transaction<NodeName>,
) => void;

/**
 * Every editing action flows through a command: a function that reports
 * whether it applies in the current state and, only when `dispatch` is
 * given, performs its edit by calling `dispatch` with the resulting
 * transaction. Calling a command with no `dispatch` is a dry run — useful
 * for deciding whether to enable a toolbar button without side effects.
 */
export type Command<NodeName extends string = string, MarkName extends string = string> = (
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
) => boolean;
