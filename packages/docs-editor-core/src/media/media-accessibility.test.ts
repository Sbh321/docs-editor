import { describe, expect, it } from "vitest";

import { createSchema } from "../schema";
import { EditorState } from "../state";

import { mediaAccessibilityIssues } from "./media-accessibility";
import {
  adjustMediaWidth,
  removeMedia,
  setMediaAlignment,
  setMediaAlt,
  setMediaSize,
} from "./media-commands";
import { mediaNodeSpecs } from "./media-node-specs";

import type { Dispatch } from "../commands";

/**
 * Accessibility is a gate, not a nicety (ROADMAP Phase 7, Milestone 7.8) — so
 * the rules that make it one are pinned here rather than left to review.
 */

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true, marks: "all" },
    ...mediaNodeSpecs(),
  },
});

const doc = (...content: ReturnType<typeof schema.node>[]) => schema.createDocument(content);

/** Audits a document built from `content`. */
const issuesIn = (...content: ReturnType<typeof schema.node>[]) =>
  mediaAccessibilityIssues(doc(...content), schema);

describe("mediaAccessibilityIssues", () => {
  it("reports an image with no alt text and no decorative mark", () => {
    const issues = issuesIn(schema.node("image", { src: "https://a.test/x.png" }));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe("missing-alt-text");
    expect(issues[0]?.nodeType).toBe("image");
  });

  it("passes an image with alt text", () => {
    expect(issuesIn(schema.node("image", { src: "https://a.test/x.png", alt: "A cat" }))).toEqual(
      [],
    );
  });

  it("passes an image deliberately marked decorative", () => {
    // An empty alt and "the author forgot" are indistinguishable in markup;
    // recording the decision separately is what lets this pass and the case
    // above fail.
    expect(
      issuesIn(schema.node("image", { src: "https://a.test/line.png", decorative: true })),
    ).toEqual([]);
  });

  it("reports media that is both decorative and has alt text", () => {
    const issues = issuesIn(
      schema.node("image", { src: "https://a.test/x.png", alt: "A cat", decorative: true }),
    );

    // Contradictory intent: the alt text would never be announced, so silently
    // honouring one of the two would hide the author's mistake.
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe("decorative-with-alt-text");
  });

  it("reports an untitled embed", () => {
    expect(issuesIn(schema.node("embed", { src: "https://a.test/e" }))[0]?.kind).toBe(
      "missing-embed-title",
    );
  });

  it("accepts an embed identified by its provider", () => {
    expect(issuesIn(schema.node("embed", { src: "https://a.test/e", provider: "test" }))).toEqual(
      [],
    );
  });

  it("does not demand alt text from attachments or audio", () => {
    // A file renders as its filename and audio as a player with controls;
    // neither is a silent image, so requiring alt text would be noise that
    // trains authors to ignore the check.
    expect(
      issuesIn(
        schema.node("file", { src: "https://a.test/r.pdf", filename: "report.pdf" }),
        schema.node("audio", { src: "https://a.test/a.mp3" }),
      ),
    ).toEqual([]);
  });

  it("finds media nested inside a figure", () => {
    const issues = issuesIn(
      schema.node("paragraph", undefined, [schema.text("Intro")]),
      schema.node("figure", undefined, [
        schema.node("image", { src: "https://a.test/x.png" }),
        schema.node("caption", undefined, [schema.text("A caption")]),
      ]),
    );

    // A caption is not a substitute for alt text — it is announced as adjacent
    // prose, not as the image's description.
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe("missing-alt-text");
  });

  it("reports issues in document order, each at a selectable position", () => {
    const document = doc(
      schema.node("image", { src: "https://a.test/1.png" }),
      schema.node("paragraph", undefined, [schema.text("Between")]),
      schema.node("image", { src: "https://a.test/2.png" }),
    );
    const issues = mediaAccessibilityIssues(document, schema);

    expect(issues).toHaveLength(2);
    expect(issues[0]?.pos).toBeLessThan(issues[1]?.pos as number);

    // The reported position must actually resolve to the offending node, or a
    // consumer cannot select or decorate it. A leaf occupies one position and a
    // paragraph two, so this is what catches the sizing being wrong.
    const state = EditorState.create({
      schema,
      doc: document,
      selection: { anchor: 2, head: 2 },
    });
    for (const issue of issues) {
      const selected = state.apply(state.tr.selectNode(issue.pos));
      expect(selected.doc.content[issue.pos === 0 ? 0 : 2]?.type).toBe("image");
    }
  });

  it("passes a document with no media at all", () => {
    expect(issuesIn(schema.node("paragraph", undefined, [schema.text("Text")]))).toEqual([]);
  });
});

describe("adjustMediaWidth (keyboard-operable resize)", () => {
  /** A state with the media node selected. */
  function stateWithSelected(node: ReturnType<typeof schema.node>) {
    const state = EditorState.create({
      schema,
      doc: doc(node, schema.node("paragraph", undefined, [schema.text("After")])),
      selection: { anchor: 1, head: 1 },
    });
    return state.apply(state.tr.selectNode(0));
  }

  /** Runs a command and returns the resulting state, or `null` if it declined. */
  function run<N extends string, M extends string>(
    state: EditorState<N, M>,
    command: (s: EditorState<N, M>, dispatch?: Dispatch<N>) => boolean,
  ): EditorState<N, M> | null {
    let next: EditorState<N, M> | null = null;
    const handled = command(state, (transaction) => {
      next = state.apply(transaction);
    });
    return handled ? next : null;
  }

  it("widens media that has an explicit width", () => {
    const state = stateWithSelected(
      schema.node("image", { src: "https://a.test/x.png", width: 200 }),
    );
    const next = run(state, adjustMediaWidth(50));

    expect(next?.doc.content[0]?.attrs.width).toBe(250);
  });

  it("narrows on a negative delta", () => {
    const state = stateWithSelected(
      schema.node("image", { src: "https://a.test/x.png", width: 200 }),
    );
    expect(run(state, adjustMediaWidth(-50))?.doc.content[0]?.attrs.width).toBe(150);
  });

  it("scales an explicit height with the width, so nothing distorts", () => {
    const state = stateWithSelected(
      schema.node("image", { src: "https://a.test/x.png", width: 200, height: 100 }),
    );
    const next = run(state, adjustMediaWidth(200));

    expect(next?.doc.content[0]?.attrs.width).toBe(400);
    expect(next?.doc.content[0]?.attrs.height).toBe(200);
  });

  it("leaves a naturally-sized height alone", () => {
    const state = stateWithSelected(
      schema.node("image", { src: "https://a.test/x.png", width: 200 }),
    );
    expect(run(state, adjustMediaWidth(50))?.doc.content[0]?.attrs.height).toBeNull();
  });

  it("uses the measured width when the node has none", () => {
    // A naturally-sized node has nothing in the model to add a delta to; only
    // the rendered element knows how wide it is.
    const state = stateWithSelected(schema.node("image", { src: "https://a.test/x.png" }));
    const next = run(state, adjustMediaWidth(20, { currentWidth: 300 }));

    expect(next?.doc.content[0]?.attrs.width).toBe(320);
  });

  it("declines when there is no width to compute from", () => {
    const state = stateWithSelected(schema.node("image", { src: "https://a.test/x.png" }));
    expect(adjustMediaWidth(20)(state)).toBe(false);
  });

  it("declines when the selection is not a node selection", () => {
    const state = EditorState.create({
      schema,
      doc: doc(schema.node("paragraph", undefined, [schema.text("Text")])),
      selection: { anchor: 1, head: 1 },
    });
    expect(adjustMediaWidth(20, { currentWidth: 100 })(state)).toBe(false);
  });

  it("clamps to minWidth rather than producing an unusable node", () => {
    const state = stateWithSelected(
      schema.node("image", { src: "https://a.test/x.png", width: 60 }),
    );
    expect(run(state, adjustMediaWidth(-500, { minWidth: 48 }))?.doc.content[0]?.attrs.width).toBe(
      48,
    );
  });

  it("clamps to maxWidth when the container bounds it", () => {
    const state = stateWithSelected(
      schema.node("image", { src: "https://a.test/x.png", width: 600 }),
    );
    expect(run(state, adjustMediaWidth(400, { maxWidth: 700 }))?.doc.content[0]?.attrs.width).toBe(
      700,
    );
  });

  it("reports handled at the bound, so the key does not move the selection", () => {
    const state = stateWithSelected(
      schema.node("image", { src: "https://a.test/x.png", width: 48 }),
    );
    // Already at the minimum: pressing the key again must not fall through to
    // the editor's own arrow-key handling.
    expect(adjustMediaWidth(-10, { minWidth: 48 })(state)).toBe(true);
  });

  it("rejects a non-finite delta at the call site", () => {
    expect(() => adjustMediaWidth(Number.NaN)).toThrow(/finite/);
  });
});

describe("commands decline rather than throw on a non-media selection", () => {
  /**
   * Regression (found by the playground in 7.8): a toolbar *dry-runs* each
   * command without `dispatch` to decide whether to enable its button. When
   * `setMediaAttrs` validated before checking applicability, selecting an
   * ordinary node and rendering a media toolbar threw
   * `Invalid attribute "align" on "divider"` — taking the whole application
   * down, from nothing more than clicking a divider.
   */
  const withDivider = createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      divider: { group: "block" },
      text: { group: "inline", isText: true, marks: "all" },
      ...mediaNodeSpecs(),
    },
  });

  /** A state with the first block selected as a node. */
  function selecting(node: ReturnType<typeof withDivider.node>) {
    const document = withDivider.createDocument([
      node,
      withDivider.node("paragraph", undefined, [withDivider.text("After")]),
    ]);
    const state = EditorState.create({
      schema: withDivider,
      doc: document,
      selection: { anchor: 1, head: 1 },
    });
    return state.apply(state.tr.selectNode(0));
  }

  it("declines to align a node that has no align attribute", () => {
    const state = selecting(withDivider.node("divider"));

    expect(() => setMediaAlignment("left")(state)).not.toThrow();
    expect(setMediaAlignment("left")(state)).toBe(false);
  });

  it("declines to resize a node that has no width attribute", () => {
    const state = selecting(withDivider.node("divider"));

    expect(setMediaSize({ width: 100 })(state)).toBe(false);
  });

  it("declines to set alt text on a node that has none", () => {
    const state = selecting(withDivider.node("divider"));

    expect(setMediaAlt("Nope")(state)).toBe(false);
  });

  it("still applies to real media", () => {
    const state = selecting(withDivider.node("image", { src: "https://a.test/x.png" }));

    expect(setMediaAlignment("left")(state)).toBe(true);
  });

  it("still throws on a genuinely invalid value for real media", () => {
    // Declining when the command doesn't apply must not turn a programmer error
    // into a silent no-op.
    expect(() => setMediaAlignment("diagonal" as never)).toThrow(/alignment/);
  });

  it("declines to remove a non-media node", () => {
    // A button labelled "remove media" must not delete a selected divider.
    const state = selecting(withDivider.node("divider"));

    expect(removeMedia(state)).toBe(false);
  });

  it("still removes real media", () => {
    const state = selecting(withDivider.node("image", { src: "https://a.test/x.png" }));

    expect(removeMedia(state)).toBe(true);
  });

  it("recognises a consumer's own media node by its group", () => {
    // Media-ness is judged by the shared group, not a hard-coded type list, so
    // a custom type that joins it works with nothing to register.
    const custom = createSchema({
      topNode: "doc",
      nodes: {
        doc: { content: "block+" },
        paragraph: { group: "block", content: "inline*" },
        text: { group: "inline", isText: true, marks: "all" },
        sketch: {
          group: "block media",
          attrs: { src: { default: "" }, align: { default: "center" } },
        },
      },
    });
    const document = custom.createDocument([
      custom.node("sketch", { src: "https://a.test/s.svg" }),
      custom.node("paragraph", undefined, [custom.text("After")]),
    ]);
    const base = EditorState.create({
      schema: custom,
      doc: document,
      selection: { anchor: 1, head: 1 },
    });
    const state = base.apply(base.tr.selectNode(0));

    expect(setMediaAlignment("left")(state)).toBe(true);
    expect(removeMedia(state)).toBe(true);
  });
});
