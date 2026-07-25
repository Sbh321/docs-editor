# Basic React Example

The minimal, public-facing reference for integrating
[@sbh321/docs-editor-react](../../packages/docs-editor-react) into a React
application. Unlike `apps/playground-react` (an internal maintainer tool),
this example is meant to be read by adopters evaluating the package.

It builds a schema, creates a document, and renders it via `EditorProvider` +
`<Editor />` — real, typeable `contentEditable` rendering, with
`nodeRenderers` mapping `paragraph` to a real `<p>`. Any node/mark without an
entry there still falls back to a generic, unstyled element named after it
(there's no theme system yet); see [docs/ROADMAP.md](../../docs/ROADMAP.md)
for the implementation phases.

## Scripts

- `pnpm dev` — start the Vite dev server
- `pnpm build` — production build
- `pnpm preview` — serve the production build
- `pnpm typecheck` — `tsc --build`
- `pnpm lint` — ESLint
