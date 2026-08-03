import { defineConfig, devices } from "@playwright/test";

/**
 * Performance specs (`*.perf.spec.ts`) measure rather than assert, so they are
 * excluded from the normal e2e run and executed on demand via `pnpm test:perf`
 * (ROADMAP Phase 6, Milestone 6.1). They run serially, since parallel workers
 * would contend for CPU and distort the timings.
 */
const perfRun = process.env.DOCS_EDITOR_PERF === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !perfRun,
  ...(perfRun ? { workers: 1 } : {}),
  testMatch: perfRun ? "**/*.perf.spec.ts" : "**/*.spec.ts",
  testIgnore: perfRun ? [] : "**/*.perf.spec.ts",
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
