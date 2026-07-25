import { describe, expect, it } from "vitest";

import { createSchema } from "../schema/schema";
import { EditorState } from "../state";

import { removeFormatting } from "./built-ins";

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true, marks: "all" },
  },
  marks: {
    bold: {},
    link: { attrs: { href: {} }, inclusive: false },
    // Excludes all other marks — inline code can't combine with bold/link.
    code: { excludes: "_" },
  },
});

describe("removeFormatting", () => {
  it("clears every mark across the selection", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello", [schema.mark("bold")])]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } });

    let next = state;
    removeFormatting(state, (transaction) => {
      next = state.apply(transaction);
    });

    expect(next.doc.content[0]?.content[0]?.marks).toEqual([]);
  });

  it("reports false with an empty selection", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    expect(removeFormatting(state)).toBe(false);
  });
});

describe("MarkSpec excludes", () => {
  it("an excludes: '_' mark replaces other marks in the range", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hi", [schema.mark("bold")])]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 3 } });

    // Add inline code over the bold text; code excludes all, so bold is dropped.
    const next = state.apply(state.tr.addMark(1, 3, schema.mark("code")));
    const marks = next.doc.content[0]?.content[0]?.marks.map((mark) => mark.type);

    expect(marks).toEqual(["code"]);
  });

  it("compiles a non-inclusive mark without error", () => {
    // The link mark is declared inclusive: false; building/using it must work.
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("Docs", [schema.mark("link", { href: "https://a.test" })]),
      ]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    expect(state.doc.content[0]?.content[0]?.marks[0]?.type).toBe("link");
  });
});
