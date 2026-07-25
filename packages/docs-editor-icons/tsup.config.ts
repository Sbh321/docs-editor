import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  // See packages/docs-editor-core/tsup.config.ts for why composite/incremental
  // are disabled here: they conflict with tsup's single-shot dts program.
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
