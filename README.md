# Docs Editor

> A professional, headless, framework-agnostic document editor — with batteries
> included when you want them.

```bash
npm install @sbh321/docs-editor
```

```tsx
import { DocsEditor } from "@sbh321/docs-editor";
import "@sbh321/docs-editor/styles.css";

export default () => <DocsEditor />;
```

That is a complete editor: a full document schema, a toolbar, an outline
sidebar, a paginated A4 page, media with uploads and resizing, find and replace,
a status bar, and light and dark themes that follow the operating system. No
configuration.

Docs Editor is a reusable editing engine — not a note-taking app, not a SaaS,
not a CMS. See [docs/PROJECT_SPEC.md](./docs/PROJECT_SPEC.md) for the vision and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the engineering design.

**Status:** Phases 0–8 complete. Editor core, React adapter, rich editing,
headless UI, import/export (HTML, Markdown, DOCX, print), performance work,
media, and the batteries-included layer. See
[docs/ROADMAP.md](./docs/ROADMAP.md).

## Which layer should I use?

Three layers, in descending order of control. Drop down whenever the one above
stops fitting — you never have to fork to customise.

| You want | Use |
| --- | --- |
| A working editor | `@sbh321/docs-editor` → `<DocsEditor />` |
| Our chrome, your layout | `@sbh321/docs-editor` → `EditorShell` + surfaces |
| Your own design system | `@sbh321/docs-editor-react` primitives |
| No framework at all | `@sbh321/docs-editor-core` |

**Nobody pays for a layer they do not import.** An application using the
headless primitives with its own design system downloads none of the styled UI,
none of the default schema, and no icons — verified by the size budgets in
[docs/PERFORMANCE.md](./docs/PERFORMANCE.md), which CI enforces.

### Customising

```tsx
<DocsEditor
  initialDocument={doc}
  onChange={save}            // receives a plain DocumentNode, not editor state
  uploader={myUploader}      // you move the bytes; the editor does the rest
  toolbarExtras={<Share />}  // your controls, inside the editor's providers
  readOnly={!canEdit}
  sidebar={null}             // or your own
/>
```

Retheme by overriding CSS custom properties — no Tailwind, no build step:

```css
:root {
  --de-accent: #7c3aed;
  --de-radius: 10px;
}
```

Add node types without starting over:

```ts
import { extendDefaultSchema } from "@sbh321/docs-editor-core/preset";

const schema = extendDefaultSchema({
  nodes: { callout: { group: "block", content: "block+" } },
});
```

## Packages

| Package | Description |
| --- | --- |
| [`docs-editor`](./packages/docs-editor-ui) | `@sbh321/docs-editor` — batteries included: styled UI and `<DocsEditor />` |
| [`docs-editor-core`](./packages/docs-editor-core) | `@sbh321/docs-editor-core` — framework-agnostic editor engine |
| [`docs-editor-react`](./packages/docs-editor-react) | `@sbh321/docs-editor-react` — React adapter + headless UI |
| [`docs-editor-icons`](./packages/docs-editor-icons) | `@sbh321/docs-editor-icons` — optional default icon set |
| [`docs-editor-markdown`](./packages/docs-editor-markdown) | `@sbh321/docs-editor-markdown` — Markdown import/export |
| [`docs-editor-docx`](./packages/docs-editor-docx) | `@sbh321/docs-editor-docx` — DOCX (Word) import/export |
| [`apps/playground-react`](./apps/playground-react) | Dev app: `<DocsEditor uploader={…} />` and nothing else — the out-of-box promise, executed literally |
| [`examples/basic-react`](./examples/basic-react) | The three-line integration (Vite) |
| [`examples/basic-next`](./examples/basic-next) | Next.js App Router integration |
| [`tooling/*`](./tooling) | Shared TypeScript and ESLint configuration |

Two entry points sit behind `@sbh321/docs-editor-core` so a consumer who does
not use them pays nothing: `/preset` (the default schema, renderers, parse rules
and keymap) and `/tables` (interactive table editing).

## Contributing

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
pnpm size:check  # enforce the bundle-size budgets
pnpm format      # Prettier
```

See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for the full contributor
guide.

## License

[MIT](./LICENSE)
