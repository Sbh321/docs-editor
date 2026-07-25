import { describe, expect, it, vi } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import { chainCommands } from "./compose";

import type { Command } from "./types";

function createTestState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
}

describe("chainCommands", () => {
  it("returns false when every command reports false", () => {
    const alwaysFails: Command = () => false;

    expect(chainCommands(alwaysFails, alwaysFails)(createTestState())).toBe(false);
  });

  it("stops at, and dispatches only through, the first command that succeeds", () => {
    const calls: string[] = [];
    const fails: Command = () => {
      calls.push("fails");
      return false;
    };
    const succeeds: Command = (_state, dispatch) => {
      calls.push("succeeds");
      dispatch?.(_state.tr);
      return true;
    };
    const neverReached: Command = () => {
      calls.push("never-reached");
      return true;
    };

    const dispatch = vi.fn();
    const result = chainCommands(fails, succeeds, neverReached)(createTestState(), dispatch);

    expect(result).toBe(true);
    expect(calls).toEqual(["fails", "succeeds"]);
    expect(dispatch).toHaveBeenCalledOnce();
  });
});
