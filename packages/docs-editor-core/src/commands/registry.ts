import { DuplicateCommandError, UnknownCommandError } from "./errors";

import type { EditorState } from "../state";
import type { Command, Dispatch } from "./types";

/**
 * Looks commands up by name. Ships empty by default — nothing is
 * auto-registered, since which commands exist under which names is an
 * application/plugin decision, not something this package should decide
 * implicitly (see CLAUDE.md's "Explicit Over Implicit").
 */
export class CommandRegistry<NodeName extends string = string, MarkName extends string = string> {
  private readonly commands = new Map<string, Command<NodeName, MarkName>>();

  /** Registers `command` under `name`. Throws if that name is already taken. */
  register(name: string, command: Command<NodeName, MarkName>): void {
    if (this.commands.has(name)) {
      throw new DuplicateCommandError(name);
    }
    this.commands.set(name, command);
  }

  /** Looks up the command registered under `name`, if any. */
  get(name: string): Command<NodeName, MarkName> | undefined {
    return this.commands.get(name);
  }

  /** Whether a command is registered under `name`. */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /** The names of every registered command. */
  names(): readonly string[] {
    return [...this.commands.keys()];
  }

  /** Runs the command registered under `name`. Throws if none is registered. */
  run(
    name: string,
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean {
    const command = this.commands.get(name);
    if (!command) {
      throw new UnknownCommandError(name);
    }
    return command(state, dispatch);
  }
}
