import { describe, expect, it } from "vitest";

import { defaultSchema } from "../preset/default-schema";
import { EditorState } from "../state";

import {
  activeFontSize,
  adjustFontSize,
  DEFAULT_FONT_SIZE,
  fontSizeStyle,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  parseFontSize,
  setFontSize,
} from "./font-size";

import type { Dispatch } from "../commands";
import type { DefaultMarkName, DefaultNodeName } from "../preset/default-schema";

/**
 * Font size (ROADMAP Phase 9, Milestone 9.2).
 *
 * Sizes are points. What is worth testing is the unit conversion at the import
 * boundary and the stepper's behaviour at its bounds — the arithmetic a
 * `− 12 +` control depends on.
 */

type State = EditorState<DefaultNodeName, DefaultMarkName>;

function stateOf(selection = { anchor: 1, head: 6 }): State {
  return EditorState.create({
    schema: defaultSchema,
    doc: defaultSchema.createDocument([
      defaultSchema.node("paragraph", undefined, [defaultSchema.text("Hello world")]),
    ]),
    selection,
  });
}

function run(
  state: State,
  command: (state: State, dispatch?: Dispatch<DefaultNodeName>) => boolean,
): { state: State; handled: boolean } {
  let next = state;
  const handled = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { state: next, handled };
}

describe("activeFontSize", () => {
  it("falls back to the body default so a stepper always has a number", () => {
    // Reporting null here would leave the first press of "+" with nothing to
    // add to.
    expect(activeFontSize(stateOf())).toBe(DEFAULT_FONT_SIZE);
  });

  it("reports the applied size", () => {
    const { state } = run(stateOf(), setFontSize(24));
    expect(activeFontSize(state)).toBe(24);
  });
});

describe("setFontSize", () => {
  it("rejects an out-of-range size at the call site", () => {
    expect(() => setFontSize(0)).toThrow(/Invalid font size/);
    expect(() => setFontSize(MAX_FONT_SIZE + 1)).toThrow(/Invalid font size/);
    expect(() => setFontSize(Number.NaN)).toThrow(/Invalid font size/);
  });
});

describe("adjustFontSize", () => {
  it("steps up and down from the current size", () => {
    const stepped = run(stateOf(), adjustFontSize(1)).state;
    expect(activeFontSize(stepped)).toBe(DEFAULT_FONT_SIZE + 1);

    const back = run(stepped, adjustFontSize(-1)).state;
    expect(activeFontSize(back)).toBe(DEFAULT_FONT_SIZE);
  });

  it("declines at the bounds so the button disables instead of no-opping", () => {
    const smallest = run(stateOf(), setFontSize(MIN_FONT_SIZE)).state;
    expect(run(smallest, adjustFontSize(-1)).handled).toBe(false);

    const largest = run(stateOf(), setFontSize(MAX_FONT_SIZE)).state;
    expect(run(largest, adjustFontSize(1)).handled).toBe(false);
  });

  it("clamps rather than overshooting a bound", () => {
    const near = run(stateOf(), setFontSize(MAX_FONT_SIZE - 2)).state;
    const pushed = run(near, adjustFontSize(100)).state;
    expect(activeFontSize(pushed)).toBe(MAX_FONT_SIZE);
  });

  it("rejects a zero delta, which could never do anything", () => {
    expect(() => adjustFontSize(0)).toThrow(/Invalid font size delta/);
  });
});

describe("serialization", () => {
  it("renders points", () => {
    expect(fontSizeStyle({ size: 18 })).toBe("font-size: 18pt");
  });

  it("converts absolute units on import", () => {
    expect(parseFontSize("16px")).toBe(12); // the 12pt = 16px equivalence
    expect(parseFontSize("18pt")).toBe(18);
    expect(parseFontSize("1in")).toBe(72);
  });

  it("declines relative units rather than guessing an inherited size", () => {
    // Their value depends on context this parser does not have; inventing one
    // would silently resize imported text.
    expect(parseFontSize("1.5em")).toBeNull();
    expect(parseFontSize("120%")).toBeNull();
    expect(parseFontSize("larger")).toBeNull();
  });

  it("declines a size outside the accepted range", () => {
    expect(parseFontSize("0pt")).toBeNull();
    expect(parseFontSize("10000pt")).toBeNull();
  });
});
