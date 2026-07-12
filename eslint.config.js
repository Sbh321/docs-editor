import tseslint from "typescript-eslint";

import { baseConfig } from "@docs-editor/eslint-config/base";
import { reactConfig } from "@docs-editor/eslint-config/react";

// ESLint flat config resolves ONE config file per run (the nearest
// eslint.config.js walking up from cwd) — it does not cascade per-package
// configs the way old-style .eslintrc did. Tools that invoke ESLint from the
// repo root (lint-staged, editors) and tools that invoke it per package
// (`turbo run lint`, cwd = package dir) both end up resolving back to this
// single file, so every package's rules are scoped here via `files` instead
// of living in a local eslint.config.js per package.
const REACT_PATHS = ["packages/docs-editor-react/**", "apps/**", "examples/**"];

export default tseslint.config(
  ...baseConfig,
  ...reactConfig.map((config) => ({
    ...config,
    files: config.files ?? REACT_PATHS,
  })),
  {
    // Leaf tooling/config files sit outside every package's tsconfig
    // "include", so they don't need (and can't get) type-aware linting.
    files: [
      "**/eslint.config.js",
      "**/tsup.config.ts",
      "**/vitest.config.ts",
      "**/vitest.setup.ts",
      "**/vite.config.ts",
      "**/playwright.config.ts",
      "**/.storybook/*.ts",
      "**/e2e/**/*.ts",
      "commitlint.config.js",
      "tooling/**/*.js",
    ],
    ...tseslint.configs.disableTypeChecked,
  },
);
