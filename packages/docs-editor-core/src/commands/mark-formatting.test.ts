import { describe, expect, it } from "vitest";

import { createSchema } from "../schema/schema";
import { EditorState } from "../state";

import { removeFormatting, setMark } from "./built-ins";

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
    fontFamily: { attrs: { family: { default: "Arial" } } },
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

describe("setMark", () => {
  it("applies a mark with a specific value across the selection", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello")]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } });

    let next = state;
    setMark("fontFamily", { family: "Georgia" })(state, (transaction) => {
      next = state.apply(transaction);
    });

    const marks = next.doc.content[0]?.content[0]?.marks;
    expect(marks).toHaveLength(1);
    expect(marks?.[0]?.type).toBe("fontFamily");
    expect(marks?.[0]?.attrs.family).toBe("Georgia");
  });

  it("replaces an existing mark of the same type rather than stacking", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [
        schema.text("Hello", [schema.mark("fontFamily", { family: "Georgia" })]),
      ]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } });

    let next = state;
    setMark("fontFamily", { family: "Verdana" })(state, (transaction) => {
      next = state.apply(transaction);
    });

    const marks = next.doc.content[0]?.content[0]?.marks;
    expect(marks).toHaveLength(1);
    expect(marks?.[0]?.attrs.family).toBe("Verdana");
  });

  it("preserves other marks on the text (only replaces its own type)", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Hello", [schema.mark("bold")])]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 6 } });

    let next = state;
    setMark("fontFamily", { family: "Verdana" })(state, (transaction) => {
      next = state.apply(transaction);
    });

    const types = next.doc.content[0]?.content[0]?.marks.map((mark) => mark.type).sort();
    expect(types).toEqual(["bold", "fontFamily"]);
  });

  it("at a collapsed cursor sets a stored mark for the next typed text", () => {
    const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hi")])]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 3, head: 3 } });

    let next = state;
    const handled = setMark("fontFamily", { family: "Courier New" })(state, (transaction) => {
      next = state.apply(transaction);
    });
    expect(handled).toBe(true);

    // Typing now carries the stored font.
    const typed = next.apply(next.tr.insertText("!"));
    const inserted = typed.doc.content[0]?.content.find((node) => node.text === "!");
    expect(inserted?.marks[0]?.attrs.family).toBe("Courier New");
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
