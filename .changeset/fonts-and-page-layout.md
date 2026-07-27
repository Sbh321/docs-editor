---
"@sbh321/docs-editor-core": minor
"@sbh321/docs-editor-react": minor
---

Add document fonts and a full page-layout system (page sizes, orientation,
margins, headers/footers, page numbers, and live pagination).

**Fonts**

- New reusable `setMark(markType, attrs)` command (core) — sets an
  attribute-carrying mark to a specific value (replacing any existing mark of
  that type), with stored-mark handling at a collapsed cursor. The "choose a
  value" counterpart to `toggleMark`; unlocks font family, and later font
  size/color.

**Page layout (core)**

- New `page-layout` module — framework-agnostic page primitives: `PAGE_SIZES`
  (A4, A3, A5, Letter, Legal, Tabloid, Executive), `PageOrientation`,
  `MARGIN_PRESETS`, `PageLayout`, and `resolvePageDimensions()`/CSS helpers.
  Page layout is presentation, kept out of the document model.
- `PrintExporter` now accepts a `pageLayout` — emits an `@page` size/margin rule
  and a running header/footer for print/PDF.

**Page layout & pagination (react)**

- New page UI: `PageLayoutProvider`/`usePageLayout`, `PageSetupControls`, and a
  `PageSurface` that renders the editor inside a correctly-sized sheet with the
  margins and running header/footer — the "docs-editor" page view.
- **Live pagination** (`PageSurface paginate` / `usePagination`): content flows
  onto multiple page sheets with gaps as it grows, recomputed on every content,
  layout, or size change. The editor stays a single contenteditable — page
  breaks are visual node-decoration spacing, never document edits — and
  measurement is done in scale-independent natural coordinates so it converges
  without oscillating. Known limitation: a block taller than a page overflows
  rather than splitting.

**Decoration extensions (core)** — enabling the above without corrupting editing:

- `Decoration` gains `type: "node"` (attribute a block's own element, e.g. a
  page-break margin) alongside the existing inline decorations.
- Decorations now compose by **source**: `EditorView.setDecorations(decos, source)`
  and `useDecorations(decos, source)` each replace only their own source and the
  view renders the union — so pagination and search highlighting coexist instead
  of overwriting each other.
- New `EditorView.posAtDOM(node, offset)` maps a rendered element back to a
  document position (used to turn a measured block into a node decoration).
