/**
 * Deterministic large-document fixtures for the performance benchmarks
 * (ROADMAP Phase 6, Milestone 6.1).
 *
 * These exist so performance is *measured against a fixed input* rather than an
 * ad-hoc one: the same options always produce byte-identical documents, so two
 * benchmark runs are comparable and a regression means a real change in the
 * code, not a change in the data.
 *
 * **Internal.** Deliberately not exported from the package barrel — Phase 6 is
 * an optimization phase with no public API changes (see ROADMAP Phase 6
 * "Guiding principles"). Benchmarks and tests import it by path.
 */

import { createFixtureSchema } from "../schema/schema.fixtures";

import type { DocumentNode, Schema } from "../schema";
import type { FixtureMarkName, FixtureNodeName } from "../schema/schema.fixtures";

/** The schema the benchmark fixtures are built against. */
export type BenchmarkSchema = Schema<FixtureNodeName, FixtureMarkName>;

export interface BenchmarkDocumentOptions {
  /** Number of top-level paragraphs. The dominant size knob. */
  readonly paragraphs: number;
  /** Insert a heading before every Nth paragraph. `0` disables headings. */
  readonly headingEvery?: number;
  /** Words per paragraph. Defaults to 24 (a realistic prose paragraph). */
  readonly wordsPerParagraph?: number;
  /** Number of tables to distribute through the document. */
  readonly tables?: number;
  /** Rows per generated table (including the header row). Defaults to 4. */
  readonly tableRows?: number;
  /** Columns per generated table. Defaults to 3. */
  readonly tableColumns?: number;
  /** Number of figures (image + caption) to distribute through the document. */
  readonly images?: number;
  /** Number of bullet lists to distribute through the document. */
  readonly lists?: number;
  /** Items per generated list. Defaults to 5. */
  readonly listItems?: number;
  /**
   * Fraction of paragraphs (0..1) that carry an inline mark, so benchmarks
   * exercise mark handling rather than plain text only. Defaults to 0.2.
   */
  readonly markedFraction?: number;
  /** Seed for the deterministic generator. Defaults to 1. */
  readonly seed?: number;
}

/**
 * Named scales used across the benchmarks, chosen to bracket the documented
 * targets: PROJECT_SPEC asks for "documents exceeding 100 pages" and "thousands
 * of paragraphs". Roughly 25 paragraphs per page, so `huge` (5000 paragraphs)
 * is a ~200-page document.
 */
export const BENCHMARK_SCALES = {
  /** A trivial document — the control, to isolate fixed overhead. */
  small: { paragraphs: 10 },
  /** A typical short document (~4 pages). */
  medium: { paragraphs: 100, headingEvery: 10, tables: 1, images: 1, lists: 1 },
  /** A long report (~40 pages) — the primary optimization target. */
  large: { paragraphs: 1000, headingEvery: 20, tables: 10, images: 10, lists: 10 },
  /** A very large document (~200 pages) — the scalability ceiling to stay usable at. */
  huge: { paragraphs: 5000, headingEvery: 25, tables: 40, images: 40, lists: 40 },
} as const satisfies Record<string, BenchmarkDocumentOptions>;

/** The name of a scale in {@link BENCHMARK_SCALES}. */
export type BenchmarkScaleName = keyof typeof BENCHMARK_SCALES;

/**
 * A small, fixed vocabulary. Real-ish prose (varied word lengths, so text
 * measurement and line breaking behave realistically) without pulling in a
 * dependency or making output depend on anything external.
 */
const WORDS = [
  "document",
  "editor",
  "content",
  "paragraph",
  "structure",
  "layout",
  "revision",
  "section",
  "heading",
  "formatting",
  "selection",
  "transaction",
  "history",
  "schema",
  "render",
  "performance",
  "measurement",
  "baseline",
  "report",
  "analysis",
  "the",
  "a",
  "of",
  "and",
  "with",
  "for",
  "in",
  "to",
] as const;

/**
 * Mulberry32 — a tiny, fast, well-distributed seeded PRNG. Used instead of
 * `Math.random` so every run produces the identical document.
 */
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

/**
 * Builds a document of the requested shape. Blocks are interleaved
 * deterministically (every Nth position gets a table/figure/list) so the
 * structure is representative rather than a flat run of paragraphs.
 */
export function createBenchmarkDocument(
  schema: BenchmarkSchema,
  options: BenchmarkDocumentOptions,
): DocumentNode<FixtureNodeName> {
  const {
    paragraphs,
    headingEvery = 0,
    wordsPerParagraph = 24,
    tables = 0,
    tableRows = 4,
    tableColumns = 3,
    images = 0,
    lists = 0,
    listItems = 5,
    markedFraction = 0.2,
    seed = 1,
  } = options;

  const random = createRandom(seed);
  const content: DocumentNode<FixtureNodeName>[] = [];

  // Spread the structural blocks evenly through the paragraph run.
  const tableEvery = tables > 0 ? Math.max(1, Math.floor(paragraphs / tables)) : 0;
  const imageEvery = images > 0 ? Math.max(1, Math.floor(paragraphs / images)) : 0;
  const listEvery = lists > 0 ? Math.max(1, Math.floor(paragraphs / lists)) : 0;

  let tablesLeft = tables;
  let imagesLeft = images;
  let listsLeft = lists;

  for (let index = 0; index < paragraphs; index += 1) {
    if (headingEvery > 0 && index % headingEvery === 0) {
      const level = index % (headingEvery * 3) === 0 ? 1 : 2;
      content.push(schema.node("heading", { level }, [schema.text(words(random, 4))]));
    }

    content.push(buildParagraph(schema, random, wordsPerParagraph, markedFraction));

    if (tableEvery > 0 && tablesLeft > 0 && index % tableEvery === tableEvery - 1) {
      content.push(buildTable(schema, random, tableRows, tableColumns));
      tablesLeft -= 1;
    }
    if (imageEvery > 0 && imagesLeft > 0 && index % imageEvery === imageEvery - 1) {
      content.push(buildFigure(schema, random));
      imagesLeft -= 1;
    }
    if (listEvery > 0 && listsLeft > 0 && index % listEvery === listEvery - 1) {
      content.push(buildList(schema, random, listItems));
      listsLeft -= 1;
    }
  }

  return schema.createDocument(content);
}

function buildParagraph(
  schema: BenchmarkSchema,
  random: () => number,
  wordCount: number,
  markedFraction: number,
): DocumentNode<FixtureNodeName> {
  const text = words(random, wordCount);
  if (random() >= markedFraction) {
    return schema.node("paragraph", undefined, [schema.text(text)]);
  }

  // A marked paragraph: split the text so one run carries a mark, which is what
  // a real formatted document looks like (and costs more to render/serialize).
  const split = Math.max(1, Math.floor(text.length / 3));
  const mark =
    random() < 0.5 ? schema.mark("bold") : schema.mark("link", { href: "https://a.test/" });
  return schema.node("paragraph", undefined, [
    schema.text(text.slice(0, split)),
    schema.text(text.slice(split), [mark]),
  ]);
}

function buildTable(
  schema: BenchmarkSchema,
  random: () => number,
  rows: number,
  columns: number,
): DocumentNode<FixtureNodeName> {
  const cell = (type: "table_cell" | "table_header") =>
    schema.node(type, undefined, [
      schema.node("paragraph", undefined, [schema.text(words(random, 3))]),
    ]);

  const rowNodes: DocumentNode<FixtureNodeName>[] = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const cells: DocumentNode<FixtureNodeName>[] = [];
    for (let column = 0; column < columns; column += 1) {
      cells.push(cell(rowIndex === 0 ? "table_header" : "table_cell"));
    }
    rowNodes.push(schema.node("table_row", undefined, cells));
  }
  return schema.node("table", undefined, rowNodes);
}

function buildFigure(schema: BenchmarkSchema, random: () => number): DocumentNode<FixtureNodeName> {
  return schema.node("figure", undefined, [
    schema.node("image", { src: "https://images.test/benchmark.png", alt: words(random, 3) }),
    schema.node("caption", undefined, [schema.text(words(random, 6))]),
  ]);
}

function buildList(
  schema: BenchmarkSchema,
  random: () => number,
  items: number,
): DocumentNode<FixtureNodeName> {
  const itemNodes: DocumentNode<FixtureNodeName>[] = [];
  for (let index = 0; index < items; index += 1) {
    itemNodes.push(
      schema.node("list_item", undefined, [
        schema.node("paragraph", undefined, [schema.text(words(random, 8))]),
      ]),
    );
  }
  return schema.node("bullet_list", undefined, itemNodes);
}

/**
 * A memoized fixture for a named scale — building a 5000-paragraph document
 * validates every node through the schema, which is far too slow to repeat
 * inside a benchmark loop. Callers get the same instance back (documents are
 * immutable, so sharing is safe).
 */
const fixtureCache = new Map<string, DocumentNode<FixtureNodeName>>();

export function benchmarkDocument(
  scale: BenchmarkScaleName,
  schema: BenchmarkSchema = benchmarkSchema(),
): DocumentNode<FixtureNodeName> {
  const cached = fixtureCache.get(scale);
  if (cached) {
    return cached;
  }
  const doc = createBenchmarkDocument(schema, BENCHMARK_SCALES[scale]);
  fixtureCache.set(scale, doc);
  return doc;
}

let sharedSchema: BenchmarkSchema | null = null;

/** The shared benchmark schema (compiled once — schema compilation is not what's being measured). */
export function benchmarkSchema(): BenchmarkSchema {
  sharedSchema ??= createFixtureSchema();
  return sharedSchema;
}

/** Total number of top-level blocks in `doc` — a quick sanity/scale readout for reports. */
export function blockCount(doc: DocumentNode<FixtureNodeName>): number {
  return doc.content.length;
}
