import { describe, expect, it } from "vitest";

import { defaultSchema } from "../preset/default-schema";
import { EditorState } from "../state";

import {
  blockIndent,
  clearParagraphFormatting,
  indent,
  MAX_INDENT,
  outdent,
  setTextAlign,
  textAlign,
} from "./paragraph-formatting";
import {
  INDENT_STEP_POINTS,
  paragraphFormattingStyle,
  parseParagraphFormatting,
} from "./paragraph-formatting-serialization";

import type { Dispatch } from "../commands";
import type { DefaultNodeName } from "../preset/default-schema";
import type { DocumentNode } from "../schema";

/**
 * Paragraph formatting (ROADMAP Phase 9, Milestone 9.1).
 *
 * The behaviour worth pinning down is the *edges*: multi-block selections,
 * blocks that cannot carry the attribute, and the list/attribute split in
 * `indent` — not that setting an attribute sets it.
 */

type State = EditorState<string, string>;

function paragraph(text: string, attrs?: Record<string, unknown>): DocumentNode<DefaultNodeName> {
  return defaultSchema.node("paragraph", attrs, [defaultSchema.text(text)]);
}

function stateOf(content: DocumentNode<DefaultNodeName>[], anchor: number, head = anchor): State {
  return EditorState.create({
    schema: defaultSchema,
    doc: defaultSchema.createDocument(content),
    selection: { anchor, head },
  });
}

/** Runs a command, returning the resulting state and whether it reported handled. */
function run(
  state: State,
  command: (state: State, dispatch?: Dispatch) => boolean,
): { state: State; handled: boolean } {
  let next = state;
  const handled = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { state: next, handled };
}

describe("setTextAlign", () => {
  it("aligns every block a multi-block selection touches", () => {
    // Two paragraphs, selection running from inside the first into the second.
    const state = stateOf([paragraph("One"), paragraph("Two")], 2, 8);
    const { state: next, handled } = run(state, setTextAlign("center"));

    expect(handled).toBe(true);
    expect(next.doc.content[0]?.attrs.align).toBe("center");
    expect(next.doc.content[1]?.attrs.align).toBe("center");
  });

  it("declines when every block already has that alignment", () => {
    // Otherwise pressing an already-active alignment button would push an
    // identical entry onto the undo history.
    const state = stateOf([paragraph("One", { align: "center" })], 2);
    expect(run(state, setTextAlign("center")).handled).toBe(false);
  });

  it("clears back to null rather than to left", () => {
    // `null` follows the page direction; `"left"` would pin an RTL document's
    // paragraph to the wrong edge.
    const state = stateOf([paragraph("One", { align: "right" })], 2);
    const { state: next } = run(state, setTextAlign(null));
    expect(next.doc.content[0]?.attrs.align).toBeNull();
  });

  it("rejects an invalid alignment at the call site", () => {
    expect(() => setTextAlign("diagonal" as "left")).toThrow(/Invalid text alignment/);
  });
});

describe("textAlign", () => {
  it("reports null for a selection whose blocks disagree", () => {
    const state = stateOf([paragraph("One", { align: "center" }), paragraph("Two")], 2, 8);
    // A button lit up here would misdescribe what pressing it does.
    expect(textAlign(state)).toBeNull();
  });

  it("reports the shared alignment when they agree", () => {
    const state = stateOf(
      [paragraph("One", { align: "right" }), paragraph("Two", { align: "right" })],
      2,
      8,
    );
    expect(textAlign(state)).toBe("right");
  });
});

describe("indent / outdent", () => {
  it("raises and lowers the attribute outside a list", () => {
    const state = stateOf([paragraph("One")], 2);
    const indented = run(state, indent()).state;
    expect(indented.doc.content[0]?.attrs.indent).toBe(1);
    expect(blockIndent(indented)).toBe(1);

    const back = run(indented, outdent()).state;
    expect(back.doc.content[0]?.attrs.indent).toBe(0);
  });

  it("declines at the bounds so the key can fall through", () => {
    expect(run(stateOf([paragraph("One")], 2), outdent()).handled).toBe(false);
    const deep = stateOf([paragraph("One", { indent: MAX_INDENT })], 2);
    expect(run(deep, indent()).handled).toBe(false);
  });

  it("nests a list item instead of indenting it by attribute", () => {
    // The whole point of the list-aware branch: an `indent` attribute here
    // would render as indented while leaving the item a structural sibling, so
    // Markdown, DOCX and the outline would all disagree with the screen.
    const doc = [
      defaultSchema.node("bullet_list", undefined, [
        defaultSchema.node("list_item", undefined, [paragraph("One")]),
        defaultSchema.node("list_item", undefined, [paragraph("Two")]),
      ]),
    ];
    const state = stateOf(doc, 13);
    const { state: next, handled } = run(state, indent());

    expect(handled).toBe(true);
    const list = next.doc.content[0];
    // The second item is now a nested list inside the first, not a sibling.
    expect(list?.content).toHaveLength(1);
    expect(list?.content[0]?.content[1]?.type).toBe("bullet_list");
    // And nothing was written to the attribute.
    expect(next.doc.content[0]?.content[0]?.content[0]?.attrs.indent).toBe(0);
  });
});

describe("clearParagraphFormatting", () => {
  it("resets alignment and indentation together", () => {
    const state = stateOf([paragraph("One", { align: "center", indent: 3 })], 2);
    const { state: next, handled } = run(state, clearParagraphFormatting);

    expect(handled).toBe(true);
    expect(next.doc.content[0]?.attrs).toMatchObject({ align: null, indent: 0 });
  });

  it("declines on an already-clean block", () => {
    expect(run(stateOf([paragraph("One")], 2), clearParagraphFormatting).handled).toBe(false);
  });
});

describe("serialization", () => {
  it("omits the style attribute entirely for an unformatted block", () => {
    // So exported HTML for a plain document stays clean and round-trips.
    expect(paragraphFormattingStyle({ align: null, indent: 0 })).toBeUndefined();
  });

  it("emits a logical margin so RTL indents from the correct edge", () => {
    const style = paragraphFormattingStyle({ align: "center", indent: 2 });
    expect(style).toContain("text-align: center");
    expect(style).toContain(`margin-inline-start: ${String(2 * INDENT_STEP_POINTS)}pt`);
    expect(style).not.toContain("margin-left");
  });

  it("round-trips through its own output", () => {
    const style = paragraphFormattingStyle({ align: "right", indent: 3 });
    const element = elementWith({ style: style ?? "" });
    expect(parseParagraphFormatting(element)).toEqual({ align: "right", indent: 3 });
  });

  it("reads the physical margin-left that Word and Google Docs emit", () => {
    const element = elementWith({ style: "margin-left: 72pt; text-align: justify" });
    expect(parseParagraphFormatting(element)).toEqual({ align: "justify", indent: 2 });
  });

  it("converts other absolute units rather than dropping them", () => {
    expect(parseParagraphFormatting(elementWith({ style: "margin-left: 96px" }))).toEqual({
      indent: 2, // 96px = 72pt = two 36pt steps
    });
    expect(parseParagraphFormatting(elementWith({ style: "margin-left: 1in" }))).toEqual({
      indent: 2,
    });
  });

  it("rounds an odd indent to the nearest level instead of discarding it", () => {
    // 40pt is not a whole number of steps; one level represents it far better
    // than none does.
    expect(parseParagraphFormatting(elementWith({ style: "margin-left: 40pt" }))).toEqual({
      indent: 1,
    });
  });

  it("declines a percentage, which has no fixed point value", () => {
    expect(parseParagraphFormatting(elementWith({ style: "margin-left: 10%" }))).toEqual({});
  });

  it("reads the legacy align attribute older exporters still emit", () => {
    expect(parseParagraphFormatting(elementWith({ align: "center" }))).toEqual({
      align: "center",
    });
  });

  it("ignores an alignment the schema does not accept", () => {
    expect(parseParagraphFormatting(elementWith({ style: "text-align: end" }))).toEqual({});
  });

  it("does not match a property inside a longer one", () => {
    // `scroll-margin-left` must not be read as `margin-left`.
    expect(parseParagraphFormatting(elementWith({ style: "scroll-margin-left: 72pt" }))).toEqual(
      {},
    );
  });
});

/** A minimal `Element` stand-in — these helpers only ever call `getAttribute`. */
function elementWith(attributes: Record<string, string>): Element {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
  } as unknown as Element;
}
