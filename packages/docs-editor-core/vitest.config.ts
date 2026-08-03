import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // Performance benchmarks (ROADMAP Phase 6) live alongside the code as
    // `*.bench.ts` and are run by `pnpm bench`, never by `pnpm test` — they
    // measure, they don't assert.
    benchmark: {
      include: ["src/**/*.bench.ts"],
    },
  },
});
