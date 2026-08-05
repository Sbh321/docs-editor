import { describe, expect, it } from "vitest";

import { createSchema } from "../schema";
import { HtmlExporter, HtmlImporter } from "../serialization";

import { mediaNodeSpecs } from "./media-node-specs";
import { mediaHtmlParseRules, mediaNodeRenderers } from "./media-serialization";

import type { MediaSchemaNodeName } from "./media-node-specs";

type NodeName = "doc" | "paragraph" | "text" | MediaSchemaNodeName;

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true, marks: "all" },
    ...mediaNodeSpecs(),
  },
});

const exporter = new HtmlExporter<NodeName, string>({
  schema,
  nodeRenderers: { ...mediaNodeRenderers<NodeName>(), paragraph: () => ["p", 0] },
});

const importer = new HtmlImporter<NodeName, string>({
  schema,
  parseSpec: {
    nodes: [{ tag: "p", node: "paragraph" }, ...(mediaHtmlParseRules<NodeName>().nodes ?? [])],
  },
});

function exportDoc(...content: ReturnType<typeof schema.node>[]) {
  return exporter.serialize(schema.createDocument(content));
}

describe("media HTML export", () => {
  it("renders each media type to its natural element", () => {
    const image = exportDoc(schema.node("image", { src: "https://a.test/x.png", alt: "X" }));
    expect(image).toContain("<img ");
    expect(image).toContain('src="https://a.test/x.png"');
    expect(exportDoc(schema.node("video", { src: "https://a.test/v.mp4" }))).toContain("<video");
    expect(exportDoc(schema.node("audio", { src: "https://a.test/a.mp3" }))).toContain("<audio");
    expect(exportDoc(schema.node("embed", { src: "https://a.test/e" }))).toContain("<iframe");

    const file = exportDoc(schema.node("file", { src: "https://a.test/d.pdf", filename: "d.pdf" }));
    expect(file).toContain('data-media="file"');
    expect(file).toContain("d.pdf");
  });

  it("emits dimensions and alignment", () => {
    const html = exportDoc(
      schema.node("image", { src: "https://a.test/x.png", width: 320, height: 240, align: "wide" }),
    );

    expect(html).toContain('width="320"');
    expect(html).toContain('height="240"');
    expect(html).toContain('data-align="wide"');
  });

  it("omits unset dimensions rather than emitting empty attributes", () => {
    const html = exportDoc(schema.node("image", { src: "https://a.test/x.png" }));
    expect(html).not.toContain("width=");
    expect(html).not.toContain("height=");
  });

  it("marks a decorative image with an empty alt", () => {
    const html = exportDoc(
      schema.node("image", { src: "https://a.test/x.png", alt: "ignored", decorative: true }),
    );
    expect(html).toContain('alt=""');
    expect(html).not.toContain("ignored");
  });

  it("sandboxes embeds and lazy-loads images", () => {
    expect(exportDoc(schema.node("embed", { src: "https://a.test/e" }))).toContain("sandbox=");
    expect(exportDoc(schema.node("image", { src: "https://a.test/x.png" }))).toContain(
      'loading="lazy"',
    );
  });

  it("refuses to emit an unsafe src, even from a hand-built document", () => {
    // Export sanitizes too: a document may predate the importer's checks or
    // have been assembled programmatically.
    const html = exportDoc(schema.node("image", { src: "javascript:alert(1)", alt: "X" }));

    expect(html).not.toContain("javascript:");
    expect(html).toContain("<img");
  });

  it("renders a figure with its caption", () => {
    const html = exportDoc(
      schema.node("figure", undefined, [
        schema.node("image", { src: "https://a.test/x.png" }),
        schema.node("caption", undefined, [schema.text("A caption")]),
      ]),
    );

    expect(html).toContain("<figure");
    expect(html).toContain("<figcaption>A caption</figcaption>");
  });
});

describe("media HTML import", () => {
  it("round-trips an image with its dimensions and alignment", () => {
    const html = exportDoc(
      schema.node("image", {
        src: "https://a.test/x.png",
        alt: "A cat",
        width: 320,
        height: 240,
        align: "left",
      }),
    );
    const back = importer.parse(html);
    const image = back.content.find((node) => node.type === "image");

    expect(image?.attrs.src).toBe("https://a.test/x.png");
    expect(image?.attrs.alt).toBe("A cat");
    expect(image?.attrs.width).toBe(320);
    expect(image?.attrs.height).toBe(240);
    expect(image?.attrs.align).toBe("left");
  });

  it("round-trips a captioned figure", () => {
    const html = exportDoc(
      schema.node("figure", undefined, [
        schema.node("image", { src: "https://a.test/x.png" }),
        schema.node("caption", undefined, [schema.text("Caption text")]),
      ]),
    );
    const figure = importer.parse(html).content.find((node) => node.type === "figure");

    expect(figure?.content[0]?.type).toBe("image");
    expect(figure?.content[1]?.content[0]?.text).toBe("Caption text");
  });

  it("round-trips video and audio flags", () => {
    const html = exportDoc(
      schema.node("video", { src: "https://a.test/v.mp4", loop: true, muted: true }),
    );
    const video = importer.parse(html).content.find((node) => node.type === "video");

    expect(video?.attrs.loop).toBe(true);
    expect(video?.attrs.muted).toBe(true);
  });

  it("drops an image whose only source is an executable URL", () => {
    // Declining the match is better than importing an empty image: there is no
    // content to keep, and a blank placeholder would just look broken.
    const back = importer.parse('<p>Text</p><img src="javascript:alert(1)" alt="X">');

    expect(back.content.some((node) => node.type === "image")).toBe(false);
    expect(JSON.stringify(back)).not.toContain("javascript:");
  });

  it("accepts a data: URL that is genuinely an image", () => {
    const back = importer.parse('<img src="data:image/png;base64,iVBORw0KGgo=" alt="Inline">');
    expect(back.content.find((node) => node.type === "image")?.attrs.src).toContain("data:image/");
  });

  it("rejects a data: URL that is markup rather than media", () => {
    const back = importer.parse('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(back.content.some((node) => node.type === "image")).toBe(false);
  });

  it("treats an explicitly empty alt as decorative", () => {
    const decorative = importer.parse('<img src="https://a.test/x.png" alt="">');
    expect(decorative.content.find((node) => node.type === "image")?.attrs.decorative).toBe(true);

    // A missing alt is an omission, not a decision.
    const missing = importer.parse('<img src="https://a.test/x.png">');
    expect(missing.content.find((node) => node.type === "image")?.attrs.decorative).toBe(false);
  });

  it("does not turn an ordinary hyperlink into a file attachment", () => {
    const back = importer.parse('<p>x</p><a href="https://a.test/page">Read more</a>');
    expect(back.content.some((node) => node.type === "file")).toBe(false);
  });

  it("imports a link marked as an attachment", () => {
    const html = exportDoc(
      schema.node("file", { src: "https://a.test/d.pdf", filename: "report.pdf" }),
    );
    const file = importer.parse(html).content.find((node) => node.type === "file");

    expect(file?.attrs.src).toBe("https://a.test/d.pdf");
    expect(file?.attrs.filename).toBe("report.pdf");
  });

  it("ignores a non-numeric dimension instead of corrupting the node", () => {
    const back = importer.parse('<img src="https://a.test/x.png" width="wide">');
    expect(back.content.find((node) => node.type === "image")?.attrs.width).toBeNull();
  });
});

describe("loading and decoding hints (ROADMAP 7.7)", () => {
  /** Exports `content` with renderers built from `options`. */
  function exportWith(
    options: Parameters<typeof mediaNodeRenderers>[0],
    ...content: ReturnType<typeof schema.node>[]
  ) {
    return new HtmlExporter<NodeName, string>({
      schema,
      nodeRenderers: { ...mediaNodeRenderers<NodeName>(options), paragraph: () => ["p", 0] },
    }).serialize(schema.createDocument(content));
  }

  it("defaults images to lazy loading and async decoding", () => {
    // A document with hundreds of images must not fetch and decode all of them
    // at once; this is what keeps that cost proportional to what is on screen.
    const html = exportDoc(schema.node("image", { src: "https://a.test/x.png" }));
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it("defaults video and audio to metadata-only preload", () => {
    const html = exportDoc(
      schema.node("video", { src: "https://a.test/v.mp4" }),
      schema.node("audio", { src: "https://a.test/a.mp3" }),
    );
    // Enough to know duration and dimensions, without streaming every clip.
    expect(html.match(/preload="metadata"/g)).toHaveLength(2);
  });

  it("lazily loads embeds, which are the most expensive media to mount", () => {
    const html = exportDoc(schema.node("embed", { src: "https://a.test/e" }));
    expect(html).toContain('loading="lazy"');
  });

  it("can load eagerly, which is what print needs", () => {
    // A lazy image that never entered the viewport may not be fetched in time
    // for printing, and a missing image in a PDF is a permanent, silent loss.
    const html = exportWith(
      { loading: "eager" },
      schema.node("image", { src: "https://a.test/x.png" }),
    );
    expect(html).toContain('loading="eager"');
    expect(html).not.toContain('loading="lazy"');
  });

  it("honours preload and decoding overrides", () => {
    const html = exportWith(
      { preload: "none", decoding: "sync" },
      schema.node("image", { src: "https://a.test/x.png" }),
      schema.node("video", { src: "https://a.test/v.mp4" }),
    );
    expect(html).toContain('decoding="sync"');
    expect(html).toContain('preload="none"');
  });
});
