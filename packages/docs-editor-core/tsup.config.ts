import { defineConfig } from "tsup";

export default defineConfig({
  // `src/tables.ts` is a second entry point so interactive table editing (and
  // the `prosemirror-tables`/`prosemirror-view` it pulls in) only reaches
  // bundles that actually import it — see docs/PERFORMANCE.md. `src/preset.ts`
  // is a third for the same reason: a consumer with their own schema should not
  // download the default one.
  entry: ["src/index.ts", "src/tables.ts", "src/preset.ts"],
  format: ["esm"],
  target: "es2022",
  // Shared modules become chunks instead of being duplicated into both entries.
  splitting: true,
  // `composite`/`incremental` (needed for our TS project-reference graph)
  // conflict with tsup's own single-shot dts program; disable them for this
  // build-only step only, leaving `tsc --build` unaffected.
  dts: { compilerOptions: { composite: false, incremental: false, stripInternal: true } },
  sourcemap: true,
  clean: true,
});
