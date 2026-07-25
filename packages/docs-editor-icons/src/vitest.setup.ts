import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// See docs-editor-react's setup for why cleanup is registered explicitly:
// Vitest doesn't expose a global `afterEach` (we don't set `test.globals`),
// so Testing Library's auto-cleanup never registers on its own.
afterEach(() => {
  cleanup();
});
