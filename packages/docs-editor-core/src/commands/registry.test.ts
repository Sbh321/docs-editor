import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import { DuplicateCommandError, UnknownCommandError } from "./errors";
import { CommandRegistry } from "./registry";

import type { Command } from "./types";

function createTestState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
}

describe("CommandRegistry", () => {
  it("starts empty", () => {
    const registry = new CommandRegistry();

    expect(registry.names()).toEqual([]);
    expect(registry.has("anything")).toBe(false);
    expect(registry.get("anything")).toBeUndefined();
  });

  it("registers and looks commands up by name", () => {
    const registry = new CommandRegistry();
    const noop: Command = () => true;

    registry.register("noop", noop);

    expect(registry.has("noop")).toBe(true);
    expect(registry.get("noop")).toBe(noop);
    expect(registry.names()).toEqual(["noop"]);
  });

  it("throws when registering a name that's already taken", () => {
    const registry = new CommandRegistry();
    registry.register("noop", () => true);

    expect(() => registry.register("noop", () => false)).toThrow(DuplicateCommandError);
  });

  it("run() invokes the registered command", () => {
    const registry = new CommandRegistry();
    registry.register("always-true", () => true);

    expect(registry.run("always-true", createTestState())).toBe(true);
  });

  it("run() throws for an unregistered name", () => {
    const registry = new CommandRegistry();

    expect(() => registry.run("missing", createTestState())).toThrow(UnknownCommandError);
  });
});
