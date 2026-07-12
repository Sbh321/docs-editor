# @sbh321/docs-editor-react

Thin React adapter for [Docs Editor](../../README.md), built on top of
[@sbh321/docs-editor-core](../docs-editor-core).

> **Status:** Scaffolding only. Implementation begins in
> [Phase 2 — React Adapter](../../docs/ROADMAP.md#phase-2--react-adapter).

## Package boundary

This package provides React integration only — the Editor component, hooks,
context, and providers. It must never duplicate editor logic that belongs in
`@sbh321/docs-editor-core`. See
[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#package-boundaries) for the
full boundary rules.

## Scripts

- `pnpm build` — bundle with tsup (ESM only)
- `pnpm dev` — bundle in watch mode
- `pnpm test` — run unit tests with Vitest + Testing Library
- `pnpm typecheck` — `tsc --build` against the TypeScript project reference graph
- `pnpm lint` — ESLint
- `pnpm storybook` — run Storybook locally
- `pnpm build-storybook` — build the static Storybook site
