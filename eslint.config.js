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
const REACT_PATHS = [
  "packages/docs-editor-react/**",
  "packages/docs-editor-icons/**",
  "apps/**",
  "examples/**",
];

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
  {
    // ProseMirror must stay encapsulated inside src/engine/ (see
    // docs/ARCHITECTURE.md's "Editing Engine" section) — everything else in
    // docs-editor-core operates on its own Schema/DocumentNode/Mark types.
    // This turns that architectural rule into a lint failure instead of a
    // convention someone can accidentally violate.
    files: ["packages/docs-editor-core/src/**/*.ts"],
    ignores: ["packages/docs-editor-core/src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["prosemirror-*"],
              message:
                "ProseMirror must stay encapsulated inside src/engine/. Use docs-editor-core's own Schema/DocumentNode/Mark types instead.",
            },
          ],
        },
      ],
    },
  },
);
