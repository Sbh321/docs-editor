import { describe, expect, it } from "vitest";

import { createSchema } from "../schema";
import { EditorState } from "../state";

import { mediaNodeSpecs } from "./media-node-specs";
import { isMediaAlignment, isMediaNodeType, MEDIA_ALIGNMENTS, MEDIA_GROUP } from "./media-types";

/**
 * The media specs are only useful if they compile into a real schema and build
 * real documents — the multi-group declaration and `figure`'s group-referencing
 * content expression are exactly the kind of thing that type-checks but fails at
 * schema-compile time.
 */
function createMediaSchema() {
  return createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      text: { group: "inline", isText: true, marks: "all" },
      ...mediaNodeSpecs(),
    },
  });
}

describe("mediaNodeSpecs", () => {
  it("compiles into a working schema", () => {
    expect(() => createMediaSchema()).not.toThrow();
  });

  it("builds every media node type", () => {
    const schema = createMediaSchema();

    expect(schema.node("image", { src: "https://a.test/x.png", alt: "X" }).type).toBe("image");
    expect(schema.node("video", { src: "https://a.test/x.mp4" }).type).toBe("video");
    expect(schema.node("audio", { src: "https://a.test/x.mp3" }).type).toBe("audio");
    expect(schema.node("file", { src: "https://a.test/x.pdf", filename: "x.pdf" }).type).toBe(
      "file",
    );
    expect(schema.node("embed", { src: "https://a.test/e" }).type).toBe("embed");
  });

  it("creates media from defaults alone, which figure's required position needs", () => {
    const schema = createMediaSchema();
    const image = schema.node("image");

    expect(image.attrs.src).toBe("");
    expect(image.attrs.align).toBe("center");
    expect(image.attrs.width).toBeNull();
    expect(image.attrs.mediaId).toBeNull();
  });

  it("lets a figure wrap any media type via the shared group", () => {
    const schema = createMediaSchema();

    // The content expression is `media caption?`, so each of these must satisfy
    // it without figure naming the types individually.
    for (const type of ["image", "video", "audio", "file", "embed"] as const) {
      const figure = schema.node("figure", undefined, [
        schema.node(type, { src: "https://a.test/asset" }),
        schema.node("caption", undefined, [schema.text("A caption.")]),
      ]);
      expect(figure.content[0]?.type).toBe(type);
      expect(figure.content[1]?.type).toBe("caption");
    }
  });

  it("allows a figure with no caption", () => {
    const schema = createMediaSchema();
    const figure = schema.node("figure", undefined, [schema.node("image")]);

    expect(figure.content).toHaveLength(1);
  });

  it("rejects a figure whose child is not media", () => {
    const schema = createMediaSchema();

    expect(() =>
      schema.node("figure", undefined, [
        schema.node("paragraph", undefined, [schema.text("not media")]),
      ]),
    ).toThrow();
  });

  it("places media in both the block group and the media group", () => {
    const specs = mediaNodeSpecs();
    expect(specs.image.group).toBe(`block ${MEDIA_GROUP}`);

    // A custom block group is honoured while media membership is preserved,
    // which is what keeps `figure` working for a consumer's own layout groups.
    const custom = mediaNodeSpecs({ group: "flow" });
    expect(custom.video.group).toBe(`flow ${MEDIA_GROUP}`);
  });

  it("honours a custom default alignment", () => {
    const specs = mediaNodeSpecs({ defaultAlignment: "full" });
    expect(specs.image.attrs?.align?.default).toBe("full");
    expect(specs.embed.attrs?.align?.default).toBe("full");
  });

  it("drives a real EditorState containing media", () => {
    const schema = createMediaSchema();
    const doc = schema.createDocument([
      schema.node("paragraph", undefined, [schema.text("Before")]),
      schema.node("figure", undefined, [
        schema.node("image", { src: "https://a.test/x.png", alt: "X" }),
        schema.node("caption", undefined, [schema.text("Caption")]),
      ]),
    ]);
    const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

    expect(state.doc.content[1]?.type).toBe("figure");
  });

  it("carries type-specific attributes", () => {
    const schema = createMediaSchema();

    expect(schema.node("video", { poster: "https://a.test/p.jpg" }).attrs.poster).toBe(
      "https://a.test/p.jpg",
    );
    expect(schema.node("file", { size: 1024 }).attrs.size).toBe(1024);
    expect(schema.node("embed", { provider: "youtube" }).attrs.provider).toBe("youtube");
    // Decorative is an explicit intent, distinct from an author's empty alt.
    expect(schema.node("image").attrs.decorative).toBe(false);
  });
});

describe("media vocabulary guards", () => {
  it("narrows alignments", () => {
    for (const alignment of MEDIA_ALIGNMENTS) {
      expect(isMediaAlignment(alignment)).toBe(true);
    }
    expect(isMediaAlignment("diagonal")).toBe(false);
    expect(isMediaAlignment(undefined)).toBe(false);
  });

  it("narrows media node types", () => {
    expect(isMediaNodeType("image")).toBe(true);
    expect(isMediaNodeType("figure")).toBe(false);
    expect(isMediaNodeType(null)).toBe(false);
  });
});
