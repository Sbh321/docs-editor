# @sbh321/docs-editor-core

Framework-agnostic document editing engine for [Docs Editor](../../README.md).

> **Status:** Scaffolding only. Implementation begins in
> [Phase 1 — Editor Core](../../docs/ROADMAP.md#phase-1--editor-core).

## Package boundary

This package must never import React, Vue, or any UI framework. It owns the
document model, commands, transactions, history, serialization, and plugin
system. See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#package-boundaries)
for the full boundary rules.

## Scripts

- `pnpm build` — bundle with tsup (ESM only)
- `pnpm dev` — bundle in watch mode
- `pnpm test` — run unit tests with Vitest
- `pnpm typecheck` — `tsc --build` against the TypeScript project reference graph
- `pnpm lint` — ESLint
