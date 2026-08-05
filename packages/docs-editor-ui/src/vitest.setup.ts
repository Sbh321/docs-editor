import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `@testing-library/react`'s own auto-cleanup only registers itself when it
// detects a global `afterEach` (e.g. Jest). Vitest doesn't expose one unless
// `test.globals: true` is set, which we deliberately don't do (see
// CLAUDE.md's "Explicit Over Implicit") — so cleanup is registered here
// explicitly instead. Without this, DOM from one test's `render()` call
// leaks into the next test in the same file.
afterEach(() => {
  cleanup();
});
