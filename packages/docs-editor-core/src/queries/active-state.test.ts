import { describe, expect, it } from "vitest";

import { toggleMark } from "../commands";
import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import { activeBlockType, activeMarks, isBlockActive, isMarkActive } from "./active-state";

import type { FixtureMarkName, FixtureNodeName } from "../schema/schema.fixtures";
import type { Selection } from "../selection";

const schema = createFixtureSchema();

function stateWith(
  text: string,
  selection: Selection,
): EditorState<FixtureNodeName, FixtureMarkName> {
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text(text)])]);
  return EditorState.create({ schema, doc, selection });
}

describe("isMarkActive / activeMarks", () => {
  it("reports a mark covering the whole selection as active", () => {
    const state = stateWith("Hello", { anchor: 1, head: 6 });
    const bolded = applyToggle(state, "bold");

    expect(isMarkActive(bolded, "bold")).toBe(true);
    expect(activeMarks(bolded).map((mark) => mark.type)).toContain("bold");
  });

  it("reports a mark covering only part of the selection as inactive", () => {
    // Bold just "He" (1..3), then widen the selection to the whole word.
    const partial = applyToggle(stateWith("Hello", { anchor: 1, head: 3 }), "bold");
    const widened = partial.apply(partial.tr.setSelection({ anchor: 1, head: 6 }));

    expect(isMarkActive(widened, "bold")).toBe(false);
  });

  it("reflects a toggled stored mark at a collapsed cursor", () => {
    const state = stateWith("Hello", { anchor: 3, head: 3 });
    const toggled = applyToggle(state, "bold");

    // No range was marked, but the next typed character would be bold.
    expect(isMarkActive(toggled, "bold")).toBe(true);
  });

  it("matches mark attributes when given, ignores them otherwise", () => {
    const state = stateWith("Hello", { anchor: 1, head: 6 });
    const linked = state.apply(
      state.tr.addMark(1, 6, schema.mark("link", { href: "https://a.test" })),
    );

    expect(isMarkActive(linked, "link")).toBe(true);
    expect(isMarkActive(linked, "link", { href: "https://a.test" })).toBe(true);
    expect(isMarkActive(linked, "link", { href: "https://other.test" })).toBe(false);
  });
});

describe("activeBlockType / isBlockActive", () => {
  it("reports the textblock the cursor sits in", () => {
    const state = stateWith("Hello", { anchor: 1, head: 1 });

    expect(activeBlockType(state).type).toBe("paragraph");
    expect(isBlockActive(state, "paragraph")).toBe(true);
    expect(isBlockActive(state, "heading")).toBe(false);
  });

  it("matches block attributes when given", () => {
    const doc = schema.createDocument([
      schema.node("heading", { level: 2 }, [schema.text("Title")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    expect(activeBlockType(state)).toEqual({ type: "heading", attrs: { level: 2 } });
    expect(isBlockActive(state, "heading", { level: 2 })).toBe(true);
    expect(isBlockActive(state, "heading", { level: 1 })).toBe(false);
  });
});

function applyToggle(
  state: EditorState<FixtureNodeName, FixtureMarkName>,
  markType: FixtureMarkName,
): EditorState<FixtureNodeName, FixtureMarkName> {
  let next = state;
  toggleMark(markType)(state, (transaction) => {
    next = state.apply(transaction);
  });
  return next;
}
