# Docs Editor

> A professional, headless, framework-agnostic document editor for modern web applications.

Docs Editor is a reusable editing engine — not a note-taking app, not a SaaS, not a CMS. It
provides the editing foundation that applications build on top of. See
[docs/PROJECT_SPEC.md](./docs/PROJECT_SPEC.md) for the full vision and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the engineering design.

**Status:** Phase 0 (Project Foundation) is complete — the monorepo, tooling, and CI are in
place. No editor functionality has been implemented yet. See
[docs/ROADMAP.md](./docs/ROADMAP.md).

## Packages

| Package | Description |
| --- | --- |
| [`packages/docs-editor-core`](./packages/docs-editor-core) | `@sbh321/docs-editor-core` — framework-agnostic editor engine |
| [`packages/docs-editor-react`](./packages/docs-editor-react) | `@sbh321/docs-editor-react` — thin React adapter |
| [`apps/playground-react`](./apps/playground-react) | Internal dev app verifying workspace linking |
| [`examples/basic-react`](./examples/basic-react) | Minimal public-facing integration reference |
| [`tooling/typescript-config`](./tooling/typescript-config) | Shared TypeScript configuration |
| [`tooling/eslint-config`](./tooling/eslint-config) | Shared ESLint flat configuration |

## Getting Started

Requirements: Node.js 20+, pnpm (via [Corepack](https://nodejs.org/api/corepack.html)).

```bash
pnpm install
pnpm build
pnpm dev
```

```bash
pnpm lint        # ESLint across all packages
pnpm typecheck   # tsc --build across the project reference graph
pnpm test        # Vitest unit tests
pnpm test:e2e    # Playwright end-to-end tests
pnpm format      # Prettier
```

See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for the full contributor guide.

## License

[MIT](./LICENSE)
