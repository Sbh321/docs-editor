/** Base class for every error a {@link CommandRegistry} throws. */
export class CommandRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DuplicateCommandError extends CommandRegistryError {
  constructor(public readonly commandName: string) {
    super(`A command named "${commandName}" is already registered.`);
  }
}

export class UnknownCommandError extends CommandRegistryError {
  constructor(public readonly commandName: string) {
    super(`No command named "${commandName}" is registered.`);
  }
}
