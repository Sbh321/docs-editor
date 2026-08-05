/**
 * Media-heavy document fixtures (ROADMAP Phase 7, Milestone 7.7).
 *
 * PROJECT_SPEC asks for documents with "hundreds of images", which the Phase 6
 * fixtures do not reach — `huge` tops out at 40 figures, because its job was to
 * scale *text*. These fixtures scale media instead, so the two knobs stay
 * independently measurable: a regression here is a media regression, not a
 * paragraph-count regression.
 *
 * Deliberately a **separate schema and module** from `./fixtures`, for two
 * reasons. It builds on the real {@link mediaNodeSpecs} rather than the ad-hoc
 * image node the Phase 6 schema declares, so the benchmarks measure what
 * consumers actually ship. And leaving `./fixtures` untouched keeps every
 * recorded Phase 6 baseline comparable — changing the shared schema would
 * silently invalidate them.
 *
 * **Internal.** Not exported from the package barrel; benchmarks and tests
 * import it by path.
 */

import { mediaNodeSpecs } from "../media";
import { createSchema } from "../schema";

import type { DocumentNode, Schema } from "../schema";

/** Node names in the media benchmark schema. */
export type MediaFixtureNodeName =
  | "doc"
  | "paragraph"
  | "heading"
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "embed"
  | "figure"
  | "caption";

/** Mark names in the media benchmark schema. */
export type MediaFixtureMarkName = "bold" | "link";

/** The schema the media fixtures are built against. */
export type MediaBenchmarkSchema = Schema<MediaFixtureNodeName, MediaFixtureMarkName>;

/**
 * A realistic media schema: ordinary prose nodes plus the shipped media
 * catalog, exactly as the README tells a consumer to compose them.
 */
export function createMediaFixtureSchema(): MediaBenchmarkSchema {
  return createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
      text: { group: "inline", isText: true, marks: "all" },
      ...mediaNodeSpecs(),
    },
    marks: {
      bold: {},
      link: { attrs: { href: {} } },
    },
  });
}

export interface MediaDocumentOptions {
  /** Number of media blocks. The dominant knob. */
  readonly media: number;
  /** Paragraphs of prose between each media block. Defaults to 2. */
  readonly paragraphsBetween?: number;
  /**
   * Wrap each media node in a `figure` with a caption. Defaults to `true` —
   * captioned figures are the realistic case and cost more nodes per media.
   */
  readonly captioned?: boolean;
  /**
   * Cycle through every media type rather than emitting images only. Defaults
   * to `false`, since "hundreds of images" is the documented target; set it to
   * measure the mixed case.
   */
  readonly mixedTypes?: boolean;
  /** Seed for the deterministic generator. Defaults to 1. */
  readonly seed?: number;
}

/**
 * Named media scales. `hundreds` is the PROJECT_SPEC target stated literally;
 * `extreme` is the ceiling to stay usable at, not a promise.
 */
export const MEDIA_SCALES = {
  /** A document with a handful of figures — the control. */
  few: { media: 10 },
  /** A photo-essay: 200 images among prose. The documented target. */
  hundreds: { media: 200 },
  /** Mixed media types at the same scale, to price the non-image nodes. */
  mixed: { media: 200, mixedTypes: true },
  /** Beyond the stated target — the scalability ceiling. */
  extreme: { media: 800 },
} as const satisfies Record<string, MediaDocumentOptions>;

/** The name of a scale in {@link MEDIA_SCALES}. */
export type MediaScaleName = keyof typeof MEDIA_SCALES;

const MEDIA_TYPES = ["image", "video", "audio", "file", "embed"] as const;

const WORDS = [
  "figure",
  "photograph",
  "diagram",
  "caption",
  "illustration",
  "chart",
  "the",
  "of",
  "a",
  "and",
] as const;

/** Mulberry32, as in `./fixtures` — deterministic so runs are comparable. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function words(random: () => number, count: number): string {
  const out: string[] = [];
  for (let index = 0; index < count; index += 1) {
    out.push(WORDS[Math.floor(random() * WORDS.length)] ?? "text");
  }
  return out.join(" ");
}

/** Builds a media-heavy document of the requested shape. */
export function createMediaDocument(
  schema: MediaBenchmarkSchema,
  options: MediaDocumentOptions,
): DocumentNode<MediaFixtureNodeName> {
  const { media, paragraphsBetween = 2, captioned = true, mixedTypes = false, seed = 1 } = options;

  const random = createRandom(seed);
  const content: DocumentNode<MediaFixtureNodeName>[] = [];

  for (let index = 0; index < media; index += 1) {
    for (let p = 0; p < paragraphsBetween; p += 1) {
      content.push(schema.node("paragraph", undefined, [schema.text(words(random, 20))]));
    }

    const type = mixedTypes ? (MEDIA_TYPES[index % MEDIA_TYPES.length] ?? "image") : "image";
    const node = buildMedia(schema, random, type, index);
    content.push(
      captioned
        ? schema.node("figure", undefined, [
            node,
            schema.node("caption", undefined, [schema.text(words(random, 6))]),
          ])
        : node,
    );
  }

  return schema.createDocument(content);
}

function buildMedia(
  schema: MediaBenchmarkSchema,
  random: () => number,
  type: (typeof MEDIA_TYPES)[number],
  index: number,
): DocumentNode<MediaFixtureNodeName> {
  // Distinct sources, so nothing benefits from an accidental identity cache
  // that a real document of distinct images would not enjoy.
  const src = `https://media.test/asset-${String(index)}`;
  const alt = words(random, 4);

  switch (type) {
    case "video":
      return schema.node("video", { src: `${src}.mp4`, alt, width: 640, height: 360 });
    case "audio":
      return schema.node("audio", { src: `${src}.mp3`, alt });
    case "file":
      return schema.node("file", {
        src: `${src}.pdf`,
        filename: `asset-${String(index)}.pdf`,
        size: 1024 * (index + 1),
        mimeType: "application/pdf",
      });
    case "embed":
      return schema.node("embed", { src: `${src}`, alt, provider: "test", aspectRatio: 1.777 });
    case "image":
    default:
      return schema.node("image", { src: `${src}.png`, alt, width: 800, height: 600 });
  }
}

/**
 * A memoized fixture for a named scale — building an 800-media document
 * validates every node through the schema, far too slow to repeat inside a
 * benchmark loop. Documents are immutable, so sharing one is safe.
 */
const fixtureCache = new Map<string, DocumentNode<MediaFixtureNodeName>>();

export function mediaDocument(
  scale: MediaScaleName,
  schema: MediaBenchmarkSchema = mediaBenchmarkSchema(),
): DocumentNode<MediaFixtureNodeName> {
  const cached = fixtureCache.get(scale);
  if (cached) {
    return cached;
  }
  const doc = createMediaDocument(schema, MEDIA_SCALES[scale]);
  fixtureCache.set(scale, doc);
  return doc;
}

let sharedSchema: MediaBenchmarkSchema | null = null;

/** The shared media benchmark schema (compiled once — compilation is not what's measured). */
export function mediaBenchmarkSchema(): MediaBenchmarkSchema {
  sharedSchema ??= createMediaFixtureSchema();
  return sharedSchema;
}

/** Counts media nodes at any depth — a sanity readout for reports. */
export function mediaCount(doc: DocumentNode<MediaFixtureNodeName>): number {
  let count = 0;
  const visit = (node: DocumentNode<MediaFixtureNodeName>): void => {
    if ((MEDIA_TYPES as readonly string[]).includes(node.type)) {
      count += 1;
    }
    for (const child of node.content) {
      visit(child);
    }
  };
  visit(doc);
  return count;
}
