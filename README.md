# Docs Editor

> A professional, headless, framework-agnostic document editor — with batteries
> included when you want them.

```tsx
import { DocsEditor } from "@sbh321/docs-editor";
import "@sbh321/docs-editor/styles.css";

export default () => <DocsEditor height="viewport" />;
```

## Introduction

Docs Editor is a reusable editing engine — not a note-taking app, not a SaaS,
not a CMS. Install one package, render one component, and you have a complete
document editor:

- A full document schema: headings, lists, task lists, tables, quotes, code,
  media (images, video, audio, files, embeds) with captions
- A toolbar with rich formatting — fonts, font size in points, colors,
  alignment, indentation, links, clear formatting
- A File menu: import and export as Markdown, HTML, JSON and DOCX, plus print
- A paginated A4 page with configurable size, orientation and margins
- Media uploads with progress, drag-and-drop, and drag-to-move blocks
- Find and replace, a slash menu, zoom, a status bar
- Light and dark themes that follow the operating system

No configuration required — and no lock-in when you outgrow the defaults.
Three layers, in descending order of control; drop down whenever the one above
stops fitting, without forking:

| You want                | Use                                            |
| ----------------------- | ---------------------------------------------- |
| A working editor        | `@sbh321/docs-editor` → `<DocsEditor />`       |
| Our chrome, your layout | `@sbh321/docs-editor` → `EditorShell` + surfaces |
| Your own design system  | `@sbh321/docs-editor-react` primitives         |
| No framework at all     | `@sbh321/docs-editor-core`                     |

**Nobody pays for a layer they do not import.** An application using the
headless primitives with its own design system downloads none of the styled UI,
none of the default schema, and no icons — verified by the size budgets in
[docs/PERFORMANCE.md](./docs/PERFORMANCE.md), which CI enforces.

See [docs/PROJECT_SPEC.md](./docs/PROJECT_SPEC.md) for the vision and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the engineering design.

**Status:** Phases 0–9.5 complete: editor core, React adapter, rich editing,
headless UI, import/export, performance work, media, the batteries-included
layer, rich formatting, and embedding & composition. See
[docs/ROADMAP.md](./docs/ROADMAP.md).

## Installation

Requires React 19. Pick your package manager:

```bash
# npm
npm install @sbh321/docs-editor

# yarn
yarn add @sbh321/docs-editor

# pnpm
pnpm add @sbh321/docs-editor
```

Then render the editor and import its stylesheet once:

```tsx
import { DocsEditor } from "@sbh321/docs-editor";
import "@sbh321/docs-editor/styles.css";

export default function App() {
  return <DocsEditor height="viewport" />;
}
```

**The editor is as big as the element you put it in** and forces no size of its
own, so give that element a height. For a full-page editor:

```css
html,
body,
#root {
  height: 100%;
  margin: 0;
}
```

Or say so directly — `<DocsEditor height="viewport" />`. Embedding it in a pane,
a tab or a flex column needs neither: give the container a height and the editor
fills it, with no CSS overrides of ours.

Building headless instead? Install only the layers you use:

```bash
# React adapter + headless (unstyled) UI primitives
npm install @sbh321/docs-editor-react

# Framework-agnostic engine only
npm install @sbh321/docs-editor-core

# Optional add-ons
npm install @sbh321/docs-editor-markdown   # Markdown import/export
npm install @sbh321/docs-editor-docx      # DOCX (Word) import/export
npm install @sbh321/docs-editor-icons     # default icon set
```

## Customizing

Everything on `<DocsEditor />` is a prop with a working default:

```tsx
<DocsEditor
  initialDocument={doc}      // the document to open (read once, on mount)
  onChange={save}            // receives a plain DocumentNode, not editor state
  uploader={myUploader}      // you move the bytes; the editor does the rest
  readOnly={!canEdit}
  height="parent"            // "viewport" or "auto" when the container has none
  fileMenu={false}           // hide import/export/print
  paginate={false}           // single continuous page
  sidebar={null}             // or your own panel
/>
```

Every toolbar control has an id, so the bar is configured rather than replaced —
hidden, reordered, or swapped for your own:

```tsx
<DocsEditor
  hiddenToolbarItems={["fontFamily", "colorScheme"]}
  toolbarItems={["file", "history", "share", "textFormat"]}
  slots={{
    toolbarItem: { share: <ShareButton /> },   // your control, anywhere in the bar
    header: <DocumentTitleBar />,              // and in every other region
    statusBarStart: <SaveIndicator />,
  }}
/>
```

Light and dark can be driven from your application, so one switch controls both:

```tsx
<DocsEditor colorScheme={scheme} onColorSchemeChange={setScheme} />
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

And when the styled editor itself stops fitting, drop a layer: compose
`EditorShell` and the styled surfaces yourself, rebuild the UI from the
`@sbh321/docs-editor-react` primitives, or drive `@sbh321/docs-editor-core`
directly with no framework at all. Every control in the shipped UI delegates to
a core command, so nothing is lost on the way down.

## Packages

| Package                                                     | Description                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`docs-editor`](./packages/docs-editor-ui)                  | `@sbh321/docs-editor` — batteries included: styled UI and `<DocsEditor />`             |
| [`docs-editor-core`](./packages/docs-editor-core)           | `@sbh321/docs-editor-core` — framework-agnostic editor engine                          |
| [`docs-editor-react`](./packages/docs-editor-react)         | `@sbh321/docs-editor-react` — React adapter + headless UI                              |
| [`docs-editor-icons`](./packages/docs-editor-icons)         | `@sbh321/docs-editor-icons` — optional default icon set                                |
| [`docs-editor-markdown`](./packages/docs-editor-markdown)   | `@sbh321/docs-editor-markdown` — Markdown import/export                                |
| [`docs-editor-docx`](./packages/docs-editor-docx)           | `@sbh321/docs-editor-docx` — DOCX (Word) import/export                                 |
| [`apps/playground-react`](./apps/playground-react)          | Dev app: `<DocsEditor uploader={…} />` and nothing else — the out-of-box promise, executed literally |
| [`examples/basic-react`](./examples/basic-react)            | The three-line integration (Vite)                                                      |
| [`examples/basic-next`](./examples/basic-next)              | Next.js App Router integration                                                         |
| [`tooling/*`](./tooling)                                    | Shared TypeScript and ESLint configuration                                             |

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
