# Basic Next.js Example

The minimal, public-facing reference for integrating
[@sbh321/docs-editor-react](../../packages/docs-editor-react) into a Next.js
(App Router) application.

It builds a schema, creates a document, and renders it via `EditorProvider` +
`<Editor />` in a client component (`app/editor-demo.tsx`) — `EditorProvider`
and `Editor` touch the DOM and hold React state, so they need a `"use
client"` boundary; the root layout and page stay Server Components.
`nodeRenderers` maps `paragraph` to a real `<p>`; any node/mark without an
entry there still falls back to a generic, unstyled element named after it
(there's no theme system yet); see [docs/ROADMAP.md](../../docs/ROADMAP.md)
for the implementation phases.

## Scripts

- `pnpm dev` — start the Next.js dev server
- `pnpm build` — production build
- `pnpm start` — serve the production build
- `pnpm typecheck` — `tsc --build`
- `pnpm lint` — ESLint
