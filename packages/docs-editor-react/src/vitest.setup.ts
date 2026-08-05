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

/**
 * jsdom implements no layout, so `document.elementFromPoint` is simply absent.
 * ProseMirror calls it from its own drop handler, which throws an *unhandled*
 * error — one that vitest reports separately from any test and that no
 * assertion can catch.
 *
 * Stubbed rather than worked around in the product code: the editor's drop
 * behaviour is correct, the environment is what is incomplete, and a test that
 * avoided dispatching real drop events would stop testing the thing it exists
 * for. Geometry-dependent behaviour is covered by the Playwright suite, in a
 * browser that has layout.
 */
if (typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}
