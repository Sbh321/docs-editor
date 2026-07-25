# Playground (React)

Internal development app used to verify that `@sbh321/docs-editor-react`,
`@sbh321/docs-editor-core`, and `@sbh321/docs-editor-icons` link, build, and
resolve correctly through the workspace. It renders a real editor with the
full Phase 4 headless UI — toolbar (with live active-state buttons), floating
toolbar, slash menu, context menu, outline panel, table of contents, and zoom
controls — themed via `ThemeProvider` and the default icon set, all covered by
Playwright e2e tests.

## Scripts

- `pnpm dev` — start the Vite dev server
- `pnpm build` — production build
- `pnpm preview` — serve the production build (used by Playwright)
- `pnpm test:e2e` — run the Playwright smoke test against the preview build
- `pnpm typecheck` — `tsc --build`
- `pnpm lint` — ESLint
