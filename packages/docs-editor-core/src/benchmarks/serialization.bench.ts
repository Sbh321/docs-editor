/**
 * Serialization benchmarks — the cost of moving whole documents in and out.
 *
 * ARCHITECTURE's Performance Budget lists "Serialization performance" and
 * "Import and export performance" as continuously monitored, and its
 * Import/Export Scalability section asks whether large documents block the main
 * thread. These numbers decide the Milestone 6.7 streaming question with data
 * rather than guesswork.
 */

import { bench, describe } from "vitest";

import { DocumentSerializer, HtmlExporter, HtmlImporter } from "../serialization";

import { benchmarkDocument, benchmarkSchema } from "./fixtures";

import type { MarkRenderer, NodeRenderer } from "../dom-output-spec";
import type { HtmlParseSpec } from "../dom-parse-spec";
import type { BenchmarkScaleName } from "./fixtures";
import type { FixtureMarkName, FixtureNodeName } from "../schema/schema.fixtures";

const schema = benchmarkSchema();
// `huge` is excluded: full-document serialization there is dominated by sheer
// size and would stretch the suite without changing the conclusion. `large`
// (~40 pages) already brackets the documented target.
const SCALES: readonly BenchmarkScaleName[] = ["small", "medium", "large"];

const nodeRenderers: NodeRenderer<FixtureNodeName> = {
  paragraph: () => ["p", 0],
  heading: (node) => [`h${Number(node.attrs.level) || 1}`, 0],
  blockquote: () => ["blockquote", 0],
  bullet_list: () => ["ul", 0],
  ordered_list: () => ["ol", 0],
  list_item: () => ["li", 0],
  divider: () => ["hr"],
  code_block: () => ["pre", ["code", 0]],
  image: (node) => ["img", { src: String(node.attrs.src), alt: String(node.attrs.alt) }],
  figure: () => ["figure", 0],
  caption: () => ["figcaption", 0],
  table: () => ["table", ["tbody", 0]],
  table_row: () => ["tr", 0],
  table_cell: () => ["td", 0],
  table_header: () => ["th", 0],
};

const markRenderers: MarkRenderer<FixtureMarkName> = {
  bold: () => ["strong", 0],
  link: (mark) => ["a", { href: String(mark.attrs.href) }, 0],
};

const parseSpec: HtmlParseSpec<FixtureNodeName, FixtureMarkName> = {
  nodes: [
    { tag: "p", node: "paragraph" },
    { tag: "h1", node: "heading", getAttrs: () => ({ level: 1 }) },
    { tag: "h2", node: "heading", getAttrs: () => ({ level: 2 }) },
    { tag: "ul", node: "bullet_list" },
    { tag: "li", node: "list_item" },
  ],
  marks: [
    { tag: "strong", mark: "bold" },
    { tag: "a", mark: "link", getAttrs: (el) => ({ href: el.getAttribute("href") ?? "" }) },
  ],
};

const serializer = new DocumentSerializer(schema);
const htmlExporter = new HtmlExporter<FixtureNodeName, FixtureMarkName>({
  schema,
  nodeRenderers,
  markRenderers,
});
const htmlImporter = new HtmlImporter<FixtureNodeName, FixtureMarkName>({ schema, parseSpec });

describe("JSON serialize", () => {
  for (const scale of SCALES) {
    const doc = benchmarkDocument(scale, schema);
    bench(`serialize (${scale})`, () => {
      serializer.serialize(doc);
    });
  }
});

describe("JSON deserialize", () => {
  for (const scale of SCALES) {
    // Deserialization rebuilds every node through the schema, so this is the
    // validation cost, not just JSON.parse.
    const json = serializer.serialize(benchmarkDocument(scale, schema));
    bench(`deserialize (${scale})`, () => {
      serializer.deserialize(json);
    });
  }
});

describe("HTML export", () => {
  for (const scale of SCALES) {
    const doc = benchmarkDocument(scale, schema);
    bench(`export (${scale})`, () => {
      htmlExporter.serialize(doc);
    });
  }
});

describe("HTML import", () => {
  for (const scale of SCALES) {
    // Includes sanitization (inert document + allowlist) and schema rebuild.
    const html = htmlExporter.serialize(benchmarkDocument(scale, schema));
    bench(`import (${scale})`, () => {
      htmlImporter.parse(html);
    });
  }
});
