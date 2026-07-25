import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  // `composite`/`incremental` (needed for our TS project-reference graph)
  // conflict with tsup's own single-shot dts program; disable them for this
  // build-only step only, leaving `tsc --build` unaffected.
  dts: { compilerOptions: { composite: false, incremental: false, stripInternal: true } },
  sourcemap: true,
  clean: true,
});
