# Playground (React)

Internal development app used to verify that `@sbh321/docs-editor-react` and
`@sbh321/docs-editor-core` link, build, and resolve correctly through the
workspace. It intentionally contains no editor UI yet.

## Scripts

- `pnpm dev` — start the Vite dev server
- `pnpm build` — production build
- `pnpm preview` — serve the production build (used by Playwright)
- `pnpm test:e2e` — run the Playwright smoke test against the preview build
- `pnpm typecheck` — `tsc --build`
- `pnpm lint` — ESLint
