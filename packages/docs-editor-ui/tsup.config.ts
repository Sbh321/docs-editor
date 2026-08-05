import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // The stylesheet is published as-is rather than bundled: consumers import
  // `@sbh321/docs-editor/styles.css` directly, and a plain CSS file works in
  // every bundler without a plugin.
  publicDir: "src/public",
  format: ["esm"],
  target: "es2022",
  // See packages/docs-editor-core/tsup.config.ts for why composite/incremental
  // are disabled here: they conflict with tsup's single-shot dts program.
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
