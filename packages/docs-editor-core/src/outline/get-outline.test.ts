import { describe, expect, it } from "vitest";

import { createFixtureSchema } from "../schema/schema.fixtures";

import { getOutline } from "./get-outline";

const schema = createFixtureSchema();

describe("getOutline", () => {
  it("returns headings in document order with level, text, and position", () => {
    const doc = schema.createDocument([
      schema.node("heading", { level: 1 }, [schema.text("Introduction")]),
      schema.node("paragraph", undefined, [schema.text("Some body text.")]),
      schema.node("heading", { level: 2 }, [schema.text("Details")]),
    ]);

    const outline = getOutline(doc);

    expect(outline).toEqual([
      { level: 1, text: "Introduction", from: 0, to: 14 },
      { level: 2, text: "Details", from: 31, to: 40 },
    ]);
  });

  it("places a cursor at a heading's start via from + 1", () => {
    const doc = schema.createDocument([
      schema.node("heading", { level: 1 }, [schema.text("Title")]),
    ]);
    const [entry] = getOutline(doc);

    // from is before the heading node; from + 1 is the first inside position.
    expect(entry?.from).toBe(0);
    expect(entry?.to).toBe(7);
  });

  it("flattens inline formatting into plain text", () => {
    const doc = schema.createDocument([
      schema.node("heading", { level: 1 }, [
        schema.text("Bold ", [schema.mark("bold")]),
        schema.text("title"),
      ]),
    ]);

    expect(getOutline(doc)[0]?.text).toBe("Bold title");
  });

  it("honours custom heading type and level attribute names", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("not a heading")]),
    ]);

    expect(getOutline(doc, { headingType: "paragraph", levelAttr: "missing" })).toEqual([
      { level: 1, text: "not a heading", from: 0, to: 15 },
    ]);
  });

  it("returns an empty outline for a document with no headings", () => {
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("plain")]),
    ]);

    expect(getOutline(doc)).toEqual([]);
  });
});
