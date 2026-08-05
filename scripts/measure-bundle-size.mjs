/**
 * Bundle-size measurement for the performance baseline (ROADMAP Phase 6,
 * Milestone 6.1) and the budgets enforced in 6.6.
 *
 * Two kinds of number are reported, because they answer different questions:
 *
 * 1. **Published package size** — every `.js` file a package emits (barrel plus
 *    any shared chunks). Useful for tracking a package's own growth.
 * 2. **Realistic consumer bundles** — synthetic entry points bundled and
 *    minified with esbuild (with `react`/`react-dom` external, since those are
 *    peer dependencies a consumer already ships). This is what a user actually
 *    downloads, including the ProseMirror engine, and it is what proves
 *    tree-shaking works: importing one primitive must not pull in the world.
 *
 * Run with `pnpm size` to report, or `pnpm size:check` to enforce the budgets
 * below and exit non-zero on a breach (this is what CI runs). Requires the
 * packages to be built.
 *
 * Only *size* is gated, never timing: bundle size is deterministic — the same
 * inputs produce the same bytes — whereas the timing benchmarks are far too
 * noisy to fail a build on (the largest serialization benchmarks reach 25%
 * relative margin of error; see docs/PERFORMANCE.md). Gating on a noisy signal
 * trains people to ignore it.
 *
 * Budgets sit roughly 10–20% above the measured baseline: loose enough that
 * ordinary work doesn't trip them, tight enough to catch a real regression —
 * particularly a return of the table-editing dependency that Milestone 6.6
 * removed from headless bundles.
 */

import { build } from "esbuild";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Module resolution anchor for the synthetic bundles. pnpm only links a
 * workspace package where it is declared as a dependency, and the playground is
 * the one workspace member that depends on all of them — so it is where a
 * bundler can resolve every `@sbh321/*` import, exactly as a real consumer app
 * would.
 */
const RESOLVE_DIR = resolve(ROOT, "apps/playground-react");

/** Packages whose built output is measured as published, with their gzip budgets (KB). */
const PACKAGES = [
  { name: "docs-editor-core", budgetKB: 44 },
  { name: "docs-editor-react", budgetKB: 20 },
  { name: "docs-editor-icons", budgetKB: 3 },
  { name: "docs-editor-markdown", budgetKB: 5 },
  { name: "docs-editor-docx", budgetKB: 5 },
  { name: "docs-editor-ui", budgetKB: 21 },
];

/**
 * Synthetic consumer entries. Each measures "if I import exactly this, what do
 * I ship?" — ordered from the smallest meaningful use to a full editor.
 */
const SCENARIOS = [
  {
    name: "minimal: schema only",
    budgetKB: 24,
    description: "createSchema — the document model with no editor",
    contents: `export { createSchema } from "@sbh321/docs-editor-core";`,
  },
  {
    name: "minimal: headless state",
    budgetKB: 45,
    description: "schema + EditorState + one command (no DOM view)",
    contents: `
      export { createSchema, EditorState, toggleMark } from "@sbh321/docs-editor-core";
    `,
  },
  {
    name: "minimal: editor, no media",
    budgetKB: 38,
    description: "a real editing setup that imports no media — the media-isolation control",
    contents: `
      export { createSchema, EditorState, toggleMark, undo, redo } from "@sbh321/docs-editor-core";
    `,
  },
  {
    name: "media: schema + commands",
    budgetKB: 42,
    description: "the same, plus the media catalog — the delta is what media costs",
    contents: `
      export {
        createSchema, EditorState, toggleMark, undo, redo,
        mediaNodeSpecs, insertMedia, removeMedia, setMediaAlignment,
        mediaNodeRenderers, MediaUploadRegistry,
      } from "@sbh321/docs-editor-core";
    `,
  },
  {
    name: "preset: default schema",
    budgetKB: 47,
    description: "the batteries-included schema + renderers + parse spec + keymap",
    contents: `
      export { defaultSchema, defaultKeymap, defaultNodeRenderers, defaultParseSpec }
        from "@sbh321/docs-editor-core/preset";
      export { EditorState } from "@sbh321/docs-editor-core";
    `,
  },
  {
    name: "core: full barrel",
    budgetKB: 95,
    description: "everything exported from docs-editor-core",
    contents: `export * from "@sbh321/docs-editor-core";`,
  },
  {
    name: "react: editor only",
    budgetKB: 80,
    description: "Editor + EditorProvider (the minimum to render an editor)",
    contents: `
      export { Editor, EditorProvider } from "@sbh321/docs-editor-react";
    `,
  },
  {
    name: "react: full barrel",
    budgetKB: 110,
    description: "everything exported from docs-editor-react (incl. core)",
    contents: `export * from "@sbh321/docs-editor-react";`,
  },
  {
    name: "ui: styled primitives",
    budgetKB: 30,
    description: "@sbh321/docs-editor primitives alone — they tree-shake free of the editor",
    contents: `
      export { Button, Dialog, DropdownMenu, Input, Popover, Select, Tooltip }
        from "@sbh321/docs-editor";
    `,
  },
  {
    name: "markdown package",
    budgetKB: 85,
    description: "docs-editor-markdown (adds markdown-it)",
    contents: `export * from "@sbh321/docs-editor-markdown";`,
  },
  {
    name: "docx package",
    budgetKB: 290,
    description: "docs-editor-docx (adds docx + mammoth — lazy-load this)",
    contents: `export * from "@sbh321/docs-editor-docx";`,
  },
];

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1).padStart(7)} KB`;
}

function gzipSize(source) {
  return gzipSync(typeof source === "string" ? Buffer.from(source) : source, { level: 9 }).length;
}

async function measureScenario(scenario) {
  const result = await build({
    stdin: {
      contents: scenario.contents,
      resolveDir: RESOLVE_DIR,
      sourcefile: "entry.js",
      loader: "js",
    },
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    // Peer dependencies a consuming app already ships — not our footprint.
    external: ["react", "react-dom", "react/jsx-runtime"],
    write: false,
    logLevel: "silent",
  });

  const output = result.outputFiles[0];
  if (!output) {
    throw new Error(`esbuild produced no output for scenario: ${scenario.name}`);
  }
  return { raw: output.contents.byteLength, gzip: gzipSize(output.contents) };
}

/** `pnpm size:check` enforces the budgets; plain `pnpm size` only reports. */
const CHECK_MODE = process.argv.includes("--check");

/** Formats one row, and in check mode reports it against its budget. */
function reportRow(label, gzipBytes, budgetKB, trailing = "") {
  const gzipKB = gzipBytes / 1024;
  if (!CHECK_MODE) {
    return { over: false, line: `${label} ${formatBytes(gzipBytes)}   ${trailing}` };
  }
  const over = gzipKB > budgetKB;
  const status = over ? "OVER " : "ok   ";
  return {
    over,
    line: `${status} ${label} ${gzipKB.toFixed(1).padStart(7)} KB / ${String(budgetKB).padStart(3)} KB budget`,
  };
}

async function main() {
  const breaches = [];

  console.log("\nPublished package output (all emitted .js, gzipped)\n");
  const missing = [];
  for (const { name, budgetKB } of PACKAGES) {
    const dist = resolve(ROOT, "packages", name, "dist");
    if (!existsSync(resolve(dist, "index.js"))) {
      missing.push(name);
      continue;
    }
    // Every emitted `.js`, not just `index.js`: since Milestone 6.6 the core
    // builds multiple entry points with code splitting, so most of its code
    // lives in shared chunk files. Measuring the barrel alone would have made
    // it look like the package halved in size when it merely moved.
    const sources = readdirSync(dist)
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(resolve(dist, file)));
    const rawBytes = sources.reduce((total, source) => total + source.byteLength, 0);
    const gzipBytes = sources.reduce((total, source) => total + gzipSize(source), 0);
    const raw = CHECK_MODE ? "" : formatBytes(rawBytes);
    const { over, line } = reportRow(name.padEnd(28), gzipBytes, budgetKB, raw);
    console.log(`  ${line}`);
    if (over) {
      breaches.push(name);
    }
  }
  if (missing.length > 0) {
    const message = `not built: ${missing.join(", ")} — run \`pnpm build\` first`;
    if (CHECK_MODE) {
      // In check mode a missing bundle means the budget went unverified, which
      // must not silently pass.
      console.error(`\n  ERROR: ${message}\n`);
      process.exit(1);
    }
    console.log(`\n  (${message})`);
  }

  console.log("\nRealistic consumer bundles (esbuild, minified, react external)\n");
  for (const scenario of SCENARIOS) {
    try {
      const { raw, gzip } = await measureScenario(scenario);
      const trailing = CHECK_MODE ? "" : `${formatBytes(raw)}   ${scenario.description}`;
      const { over, line } = reportRow(scenario.name.padEnd(28), gzip, scenario.budgetKB, trailing);
      console.log(`  ${line}`);
      if (over) {
        breaches.push(scenario.name);
      }
    } catch (error) {
      console.error(`  ${scenario.name.padEnd(28)} FAILED  ${String(error)}`);
      if (CHECK_MODE) {
        breaches.push(scenario.name);
      }
    }
  }

  if (!CHECK_MODE) {
    console.log("");
    return;
  }

  if (breaches.length > 0) {
    console.error(
      `\nBundle size budget exceeded: ${breaches.join(", ")}.\n\n` +
        `Find what grew with:\n` +
        `  node scripts/explain-bundle.mjs <package-name>\n\n` +
        `If the growth is intended, raise the budget in scripts/measure-bundle-size.mjs\n` +
        `and record why in docs/PERFORMANCE.md.\n`,
    );
    process.exit(1);
  }
  console.log("\nAll bundle size budgets met.\n");
}

await main();
