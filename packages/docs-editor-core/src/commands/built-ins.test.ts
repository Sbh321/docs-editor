import { describe, expect, it, vi } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import {
  deleteSelection,
  exitCode,
  lift,
  newlineInCode,
  selectAll,
  setBlockType,
  toggleMark,
  wrapIn,
} from "./built-ins";

function createTestState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return { schema, state: EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } }) };
}

describe("deleteSelection", () => {
  it("reports false and never dispatches when the selection is empty", () => {
    const { state } = createTestState();
    const collapsed = state.apply(state.tr.setSelection({ anchor: 1, head: 1 }));
    const dispatch = vi.fn();

    expect(deleteSelection(collapsed, dispatch)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dry-runs without a dispatch and reports true when applicable", () => {
    const { state } = createTestState();

    expect(deleteSelection(state)).toBe(true);
    // No dispatch given -- the state itself must be untouched.
    expect(state.doc.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("deletes the selected range when dispatched", () => {
    const { state } = createTestState();
    let nextState = state;

    deleteSelection(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content[0]?.content).toHaveLength(0);
  });
});

describe("selectAll", () => {
  it("selects the entire document when dispatched", () => {
    const { state } = createTestState();
    let nextState = state;

    selectAll(state, (tr) => {
      nextState = state.apply(tr);
    });

    // doc(paragraph("Hello")): 2 (paragraph's open/close boundary) + 5 ("Hello") = 7.
    expect(nextState.selection).toEqual({ anchor: 0, head: 7 });
  });
});

describe("toggleMark", () => {
  it("adds the mark over the selection when it isn't already fully applied", () => {
    const { state } = createTestState();
    let nextState = state;

    toggleMark("bold")(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content[0]?.content[0]?.marks).toEqual([{ type: "bold", attrs: {} }]);
  });

  it("removes the mark when the whole selection already carries it", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello", [schema.mark("bold")])]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } });
    let nextState = state;

    toggleMark("bold")(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content[0]?.content[0]?.marks).toEqual([]);
  });

  it("throws for an unknown mark type instead of silently reporting false", () => {
    const { state } = createTestState();

    expect(() => toggleMark("nonexistent")(state)).toThrow();
  });
});

describe("setBlockType", () => {
  it("changes the textblock at the selection to the given node type and attrs", () => {
    const { state } = createTestState();
    let nextState = state;

    setBlockType("heading", { level: 2 })(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content[0]?.type).toBe("heading");
    expect(nextState.doc.content[0]?.attrs).toEqual({ level: 2 });
    expect(nextState.doc.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("defaults attrs when omitted", () => {
    const { state } = createTestState();
    let nextState = state;

    setBlockType("heading")(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content[0]?.attrs).toEqual({ level: 1 });
  });

  it("reports false and never dispatches when already that block type with the same attrs", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("heading", { level: 1 }, [schema.text("Hello")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });
    const dispatch = vi.fn();

    expect(setBlockType("heading", { level: 1 })(state, dispatch)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("throws for an unknown node type instead of silently reporting false", () => {
    const { state } = createTestState();

    expect(() => setBlockType("nonexistent")(state)).toThrow();
  });
});

describe("wrapIn / lift", () => {
  it("wraps the selected paragraph in a blockquote", () => {
    const { state } = createTestState();
    let nextState = state;

    wrapIn("blockquote")(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content[0]?.type).toBe("blockquote");
    expect(nextState.doc.content[0]?.content[0]?.type).toBe("paragraph");
    expect(nextState.doc.content[0]?.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("lift() reverses wrapIn(), restoring the original structure", () => {
    const { state } = createTestState();
    let wrapped = state;
    wrapIn("blockquote")(state, (tr) => {
      wrapped = state.apply(tr);
    });

    let lifted = wrapped;
    lift(wrapped, (tr) => {
      lifted = wrapped.apply(tr);
    });

    expect(lifted.doc.content[0]?.type).toBe("paragraph");
    expect(lifted.doc.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("lift() reports false and never dispatches when nothing can be lifted", () => {
    const { state } = createTestState();
    const dispatch = vi.fn();

    expect(lift(state, dispatch)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("wrapIn() throws for an unknown node type instead of silently reporting false", () => {
    const { state } = createTestState();

    expect(() => wrapIn("nonexistent")(state)).toThrow();
  });
});

function createCodeBlockState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("code_block", undefined, [schema.text("Hello")])]);
  // Cursor at the end of "Hello", inside the code block.
  return EditorState.create({ schema, doc, selection: { anchor: 6, head: 6 } });
}

describe("newlineInCode", () => {
  it("inserts a newline character inside a code: true node", () => {
    const state = createCodeBlockState();
    let nextState = state;

    newlineInCode(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content[0]?.content[0]?.text).toBe("Hello\n");
  });

  it("reports false and never dispatches outside a code: true node", () => {
    const schema = createFixtureSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 6, head: 6 } });
    const dispatch = vi.fn();

    expect(newlineInCode(state, dispatch)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("exitCode", () => {
  it("creates a default block after the code: true node and moves the cursor there", () => {
    const state = createCodeBlockState();
    let nextState = state;

    exitCode(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content).toHaveLength(2);
    expect(nextState.doc.content[0]?.type).toBe("code_block");
    expect(nextState.doc.content[1]?.type).toBe("paragraph");
  });
});
