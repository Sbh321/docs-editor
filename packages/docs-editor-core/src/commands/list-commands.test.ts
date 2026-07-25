import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";
import { EditorState } from "../state";

import { liftListItem, sinkListItem, splitListItem, wrapInList } from "./list-commands";

function createParagraphState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
  return EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } });
}

function createTwoItemListState() {
  const schema = createFixtureSchema();
  const doc = schema.createDocument([
    schema.node("bullet_list", undefined, [
      schema.node("list_item", undefined, [
        schema.node("paragraph", undefined, [schema.text("One")]),
      ]),
      schema.node("list_item", undefined, [
        schema.node("paragraph", undefined, [schema.text("Two")]),
      ]),
    ]),
  ]);
  // Collapsed cursor at the end of "Two", inside the second list item.
  return EditorState.create({ schema, doc, selection: { anchor: 13, head: 13 } });
}

describe("wrapInList", () => {
  it("wraps the selected paragraph in a bullet_list/list_item", () => {
    const state = createParagraphState();
    let nextState = state;

    wrapInList("bullet_list")(state, (tr) => {
      nextState = state.apply(tr);
    });

    const list = nextState.doc.content[0];
    expect(list?.type).toBe("bullet_list");
    expect(list?.content[0]?.type).toBe("list_item");
    expect(list?.content[0]?.content[0]?.type).toBe("paragraph");
    expect(list?.content[0]?.content[0]?.content[0]?.text).toBe("Hello");
  });

  it("applies attrs (ordered_list's order)", () => {
    const state = createParagraphState();
    let nextState = state;

    wrapInList("ordered_list", { order: 3 })(state, (tr) => {
      nextState = state.apply(tr);
    });

    expect(nextState.doc.content[0]?.type).toBe("ordered_list");
    expect(nextState.doc.content[0]?.attrs).toEqual({ order: 3 });
  });

  it("throws for an unknown node type instead of silently reporting false", () => {
    const state = createParagraphState();
    expect(() => wrapInList("nonexistent")(state)).toThrow();
  });
});

describe("splitListItem", () => {
  it("splits the current list item into two, at the cursor", () => {
    const state = createParagraphState();
    let listState = state;
    wrapInList("bullet_list")(state, (tr) => {
      listState = state.apply(tr);
    });

    // Cursor at the end of "Hello", inside the (only) list item's paragraph.
    const atEnd = listState.apply(listState.tr.setSelection({ anchor: 8, head: 8 }));
    let nextState = atEnd;

    splitListItem("list_item")(atEnd, (tr) => {
      nextState = atEnd.apply(tr);
    });

    const list = nextState.doc.content[0];
    expect(list?.content).toHaveLength(2);
    expect(list?.content[0]?.content[0]?.content[0]?.text).toBe("Hello");
    expect(list?.content[1]?.content[0]?.content).toHaveLength(0);
  });

  it("reports false and never dispatches outside a list item", () => {
    const state = createParagraphState();
    let dispatched = false;

    expect(splitListItem("list_item")(state, () => (dispatched = true))).toBe(false);
    expect(dispatched).toBe(false);
  });
});

describe("liftListItem", () => {
  it("lifts a single-item list's content back out to a plain paragraph", () => {
    const state = createParagraphState();
    let listState = state;
    wrapInList("bullet_list")(state, (tr) => {
      listState = state.apply(tr);
    });

    let nextState = listState;
    liftListItem("list_item")(listState, (tr) => {
      nextState = listState.apply(tr);
    });

    expect(nextState.doc.content[0]?.type).toBe("paragraph");
    expect(nextState.doc.content[0]?.content[0]?.text).toBe("Hello");
  });
});

describe("sinkListItem", () => {
  it("nests the second list item under the first, as a sub-list", () => {
    const state = createTwoItemListState();
    let nextState = state;

    sinkListItem("list_item")(state, (tr) => {
      nextState = state.apply(tr);
    });

    const list = nextState.doc.content[0];
    expect(list?.content).toHaveLength(1); // only the first item remains at the top level
    const firstItem = list?.content[0];
    expect(firstItem?.content[0]?.content[0]?.text).toBe("One");
    const nestedList = firstItem?.content[1];
    expect(nestedList?.type).toBe("bullet_list");
    expect(nestedList?.content[0]?.content[0]?.content[0]?.text).toBe("Two");
  });
});
