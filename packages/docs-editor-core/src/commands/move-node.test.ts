import { describe, expect, it } from "vitest";

import { defaultSchema } from "../preset/default-schema";
import { EditorState } from "../state";

import { moveBlock, moveNode, topLevelBlocks } from "./move-node";

import type { Dispatch } from "./types";
import type { DefaultMarkName, DefaultNodeName } from "../preset/default-schema";

/**
 * Moving nodes (ROADMAP Phase 9, Milestone 9.4).
 *
 * Position arithmetic is what makes this easy to get wrong: deleting a node
 * shifts everything after it, so a naive "delete then insert at the target"
 * lands one node-width off whenever the move is forwards.
 */

type State = EditorState<DefaultNodeName, DefaultMarkName>;

function docOf(...texts: string[]): State {
  return EditorState.create({
    schema: defaultSchema,
    doc: defaultSchema.createDocument(
      texts.map((text) => defaultSchema.node("paragraph", undefined, [defaultSchema.text(text)])),
    ),
    selection: { anchor: 1, head: 1 },
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

const texts = (state: State): (string | undefined)[] =>
  state.doc.content.map((block) => block.content[0]?.text);

describe("topLevelBlocks", () => {
  it("reports each block's position and size", () => {
    // "A" is 1 character, so the paragraph occupies 1 + 2 = 3 positions.
    const blocks = topLevelBlocks(docOf("A", "BB"));
    expect(blocks).toEqual([
      { pos: 0, size: 3, type: "paragraph" },
      { pos: 3, size: 4, type: "paragraph" },
    ]);
  });
});

describe("moveNode", () => {
  it("moves a block backwards", () => {
    const state = docOf("one", "two", "three");
    const blocks = topLevelBlocks(state);
    const { state: next, handled } = run(state, moveNode(blocks[2]!.pos, blocks[0]!.pos));

    expect(handled).toBe(true);
    expect(texts(next)).toEqual(["three", "one", "two"]);
  });

  it("moves a block forwards, accounting for the shift its own removal causes", () => {
    // The case a naive implementation gets wrong: after deleting the first
    // block, every later position has moved left by its size.
    const state = docOf("one", "two", "three");
    const blocks = topLevelBlocks(state);
    const end = blocks[2]!.pos + blocks[2]!.size;
    const { state: next } = run(state, moveNode(blocks[0]!.pos, end));

    expect(texts(next)).toEqual(["two", "three", "one"]);
  });

  it("declines a drop inside the node being moved", () => {
    const state = docOf("one", "two");
    const first = topLevelBlocks(state)[0]!;
    // A node cannot contain itself, and the arithmetic would produce nonsense.
    expect(run(state, moveNode(first.pos, first.pos + 1)).handled).toBe(false);
    expect(run(state, moveNode(first.pos, first.pos)).handled).toBe(false);
  });

  it("declines when there is no node at the source", () => {
    expect(run(docOf("one"), moveNode(999, 0)).handled).toBe(false);
  });

  it("preserves the moved node's content", () => {
    const state = EditorState.create({
      schema: defaultSchema,
      doc: defaultSchema.createDocument([
        defaultSchema.node("paragraph", undefined, [defaultSchema.text("plain")]),
        defaultSchema.node("bullet_list", undefined, [
          defaultSchema.node("list_item", undefined, [
            defaultSchema.node("paragraph", undefined, [defaultSchema.text("item")]),
          ]),
        ]),
      ]),
      selection: { anchor: 1, head: 1 },
    });
    const blocks = topLevelBlocks(state);
    const { state: next } = run(state, moveNode(blocks[1]!.pos, blocks[0]!.pos));

    expect(next.doc.content[0]?.type).toBe("bullet_list");
    expect(next.doc.content[0]?.content[0]?.content[0]?.content[0]?.text).toBe("item");
  });
});

describe("moveBlock", () => {
  it("moves the block at the cursor up and down", () => {
    const state = docOf("one", "two", "three");
    // Cursor inside "two". The first paragraph holds 3 characters plus its two
    // boundary tokens, so it spans 0..5 and 5 is the *boundary* — 7 is inside.
    const inSecond = EditorState.create({
      schema: defaultSchema,
      doc: state.doc,
      selection: { anchor: 7, head: 7 },
    });

    const up = run(inSecond, moveBlock("up")).state;
    expect(texts(up)).toEqual(["two", "one", "three"]);

    const down = run(inSecond, moveBlock("down")).state;
    expect(texts(down)).toEqual(["one", "three", "two"]);
  });

  it("declines at the ends, so the key falls through", () => {
    const state = docOf("one", "two");
    expect(run(state, moveBlock("up")).handled).toBe(false);

    const last = EditorState.create({
      schema: defaultSchema,
      doc: state.doc,
      selection: { anchor: 7, head: 7 },
    });
    expect(run(last, moveBlock("down")).handled).toBe(false);
  });

  it("moves the whole top-level block, not the innermost node", () => {
    // With the cursor in a list item's paragraph, the gesture means "move the
    // list", not "drag this paragraph out of its item".
    const state = EditorState.create({
      schema: defaultSchema,
      doc: defaultSchema.createDocument([
        defaultSchema.node("paragraph", undefined, [defaultSchema.text("before")]),
        defaultSchema.node("bullet_list", undefined, [
          defaultSchema.node("list_item", undefined, [
            defaultSchema.node("paragraph", undefined, [defaultSchema.text("item")]),
          ]),
        ]),
      ]),
      // Inside the list item's paragraph.
      selection: { anchor: 12, head: 12 },
    });

    const { state: next, handled } = run(state, moveBlock("up"));
    expect(handled).toBe(true);
    expect(next.doc.content[0]?.type).toBe("bullet_list");
    expect(next.doc.content[1]?.content[0]?.text).toBe("before");
  });
});
