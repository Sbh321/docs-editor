/**
 * Explains *why* a dependency ends up in a bundle (ROADMAP Phase 6, Milestones
 * 6.6 and 6.8).
 *
 * When a size budget regresses, the useful question is not "how big is it" but
 * "what dragged this in". This bundles a synthetic entry point, then walks the
 * esbuild metafile's import graph to print the shortest path from the entry to
 * the named package — turning a size regression into a specific import to fix.
 *
 * Usage:
 *   node scripts/explain-bundle.mjs <package> [entry-source]
 *
 * Examples:
 *   node scripts/explain-bundle.mjs prosemirror-view
 *   node scripts/explain-bundle.mjs prosemirror-tables \
 *     'export { EditorState } from "@sbh321/docs-editor-core";'
 */

import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** See scripts/measure-bundle-size.mjs for why resolution is anchored here. */
const RESOLVE_DIR = resolve(ROOT, "apps/playground-react");

const DEFAULT_ENTRY = `export { createSchema, EditorState, toggleMark } from "@sbh321/docs-editor-core";`;

const target = process.argv[2];
const entrySource = process.argv[3] ?? DEFAULT_ENTRY;

if (!target) {
  console.error("Usage: node scripts/explain-bundle.mjs <package> [entry-source]");
  process.exit(1);
}

const result = await build({
  stdin: { contents: entrySource, resolveDir: RESOLVE_DIR, sourcefile: "entry.js", loader: "js" },
  bundle: true,
  minify: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["react", "react-dom", "react/jsx-runtime"],
  write: false,
  metafile: true,
  logLevel: "silent",
});

const inputs = result.metafile.inputs;
const tidy = (path) =>
  path.replace(/^.*node_modules\//, "").replace(/^.*\/packages\//, "packages/");

const entry = Object.keys(inputs).find((path) => path.includes("stdin")) ?? Object.keys(inputs)[0];
const matches = (path) => path.includes(`${target}/`) || path.includes(`${target}\\`);

if (!Object.keys(inputs).some(matches)) {
  console.log(`\n"${target}" is NOT in the bundle for this entry.\n`);
  process.exit(0);
}

// Breadth-first, so the path printed is the shortest reason it is included.
const queue = [[entry]];
const seen = new Set([entry]);
let found = null;

while (queue.length > 0) {
  const path = queue.shift();
  const current = path[path.length - 1];
  if (current !== entry && matches(current)) {
    found = path;
    break;
  }
  for (const imported of inputs[current]?.imports ?? []) {
    const next = imported.path;
    if (!inputs[next] || seen.has(next)) {
      continue;
    }
    seen.add(next);
    queue.push([...path, next]);
  }
}

console.log(`\nWhy is "${target}" bundled?\n`);
if (!found) {
  console.log("  Present in the bundle, but no import path was found (unexpected).\n");
  process.exit(0);
}
found.forEach((step, index) => {
  console.log(`  ${index === 0 ? "entry" : `${"  ".repeat(index)}└─`} ${tidy(step)}`);
});
console.log("");
