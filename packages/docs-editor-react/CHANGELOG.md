# @sbh321/docs-editor-react

## 0.1.0

### Minor Changes

- 9949369: Add `@sbh321/docs-editor` with its design tokens, and resolve light/dark out of
  the box (Phase 8 — Batteries-Included Editor, Milestone 8.2).

  **New package.** `@sbh321/docs-editor` is where the styled, assembled editor
  will live. It sits above `docs-editor-react` rather than inside it, so the
  headless packages stay headless: an application using the primitives with its
  own design system downloads none of this.

  ```ts
  import "@sbh321/docs-editor/styles.css";
  ```

  Plain CSS with custom properties — no Tailwind, no PostCSS plugin, no build
  configuration. Retheme by overriding tokens:

  ```css
  :root {
    --de-accent: #7c3aed;
    --de-radius: 10px;
  }
  ```

  Colours come in pairs named for their role rather than appearance (`--de-muted`
  / `--de-muted-foreground`), so a dark scheme is a different set of _values_
  rather than a different set of rules.

  **Light and dark work with no configuration.** The system preference is the
  default and an explicit choice overrides it **in both directions** — supporting
  only "follow the system" is the usual bug. `ThemeProvider` gains `colorScheme`,
  `defaultColorScheme`, `onColorSchemeChange` and `applyToDocument`, and the new
  `useColorScheme()` hook reports the resolved scheme with a light → dark → system
  toggle. It works without a provider too, falling back to reading the system
  directly.

  **Contrast is verified, not asserted.** Every text pair meets WCAG AA (4.5:1)
  and every control boundary meets 3:1, in both schemes — checked by parsing the
  shipped stylesheet rather than a copy of its values, so the test cannot pass
  while the real CSS drifts. Two colours are deliberately heavier than a purely
  aesthetic palette would pick: `--de-muted-foreground` (secondary text is still
  text, and the lighter value read at 4.35:1) and `--de-border-strong` (a control's
  boundary is what identifies it).

- 101c96f: Add document fonts and a full page-layout system (page sizes, orientation,
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

- 9949369: Media accessibility as a gate (Phase 7 — Media, Milestone 7.8).

  **Keyboard-operable resize and alignment.** `adjustMediaWidth(delta, options)`
  widens or narrows the selected media while preserving its aspect ratio. Dragging
  a corner is a pointer gesture with no keyboard equivalent, so the React node
  views now bind arrow keys to resize (Shift for a larger step) and Alt+arrows to
  alignment. Unmodified arrows still fall through, so the caret is never trapped
  on a media node.

  **`mediaAccessibilityIssues(doc, schema)`** reports a document's media
  accessibility problems as data — missing alt text, an untitled embed, or media
  marked decorative _and_ given alt text — each with a position an application can
  select or decorate. It takes the schema because a leaf node occupies one
  position and a node with content occupies its content plus two, so positions
  cannot be derived from a document tree alone.

  Media node views are now focusable, expose `role="group"` and an `aria-label`
  built from the node's description (falling back to "(no description)" so a gap
  is announced rather than silent), and mark selection with `aria-selected`.

  **Two fixes found by integrating media into the playground:**

  - `setMediaAttrs` validated attributes _before_ checking whether the command
    applied, so a toolbar dry-running it against a non-media selection threw
    `Invalid attribute "align" on "divider"` and took down the application.
    Commands now decline when the selected node's type does not declare the
    attributes. A genuinely invalid value still throws.
  - `removeMedia` deleted whatever node was selected, so a button labelled "remove
    media" would delete a selected divider. It now applies only to nodes in the
    shared `media` group — which means a consumer's own media node works with
    nothing to register.
  - Editing alt text updated the wrapper's label but not the image's own `alt`,
    because the element is only rebuilt when `src` changes. Text alternatives are
    now refreshed in place, without a re-fetch or a restarted video.

- 9949369: Add a node-view API and interactive media rendering with drag-to-resize
  (Phase 7 — Media, Milestone 7.5).

  **Core** gains a documented node-view API — `NodeViewFactory`, `NodeViewSpec`,
  `NodeViewContext` — and a `nodeViews` option on `EditorView` (and on React's
  `<Editor>`). `nodeRenderers` answers "what DOM does this node produce?", which
  is enough for static content but not for a node the user manipulates directly:
  a resizable image needs its own element, lifecycle, and the ability to keep its
  chrome out of the editor's mutation handling. A node view takes precedence over
  a renderer for the same type.

  The interface is a small, documented subset of the engine's own view protocol,
  so no ProseMirror type crosses the package boundary. `getPos` is a function
  rather than a value because a node moves as the document is edited — the same
  staleness trap `mediaId` avoids for uploads.

  **React** gains `createMediaNodeViews` / `useMediaNodeViews`: node views for
  image, video, audio, file and embed, with corner handles that resize by drag.
  Resizing previews live by styling only and writes to the document once on
  release, so a drag produces one undo step rather than dozens. Images get
  `loading="lazy"` and `decoding="async"`, and embeds are sandboxed.

- a3bb928: Phase 4 — User Interface: a headless, framework-agnostic UI layer.

  **core** — active-state queries (`isMarkActive`, `activeMarks`,
  `isBlockActive`, `activeBlockType`), `getTextBefore` for trigger detection,
  `getOutline` for document navigation, `EditorView.coordsAtPos` for anchoring
  floating UI, `Transaction.scrollIntoView`, and a decoration/overlay layer
  (`Decoration` + `EditorView.setDecorations`) for painting ranges without
  editing the document.

  **react** — query/command hooks (`useIsMarkActive`, `useIsBlockActive`,
  `useCommand`, `useOutline`, `useEditorView`) and headless UI components:
  `Toolbar`/`ToolbarButton`/`ToolbarGroup`/`ToolbarSeparator`, `FloatingToolbar`,
  `SlashMenu`, `ContextMenu`, `OutlinePanel`, `TableOfContents`, `ZoomProvider`/
  `ZoomControls`, and `ThemeProvider`, plus `useSearchHighlight`/
  `<SearchHighlight>` (and the generic `useDecorations`) for search-match
  highlighting. `<Editor />` gained a `style` prop and publishes its view via
  context. Every component is unstyled behavior only — styling and icons stay
  optional.

  **icons** (new package) — an optional default icon set: a shared `Icon` shell,
  tree-shakeable glyph components, and a `defaultIcons` map keyed by editor
  intent for feeding `ThemeProvider`.

- 9949369: Add `useMediaUploads`, and complete the editor surfaces (Phase 8 —
  Batteries-Included Editor, Milestones 8.4 and 8.6).

  **`useMediaUploads(registry)`** connects a `MediaUploadRegistry` to the
  document. The registry never touches the document and the document never holds
  upload state — that separation is what keeps placeholders out of undo history —
  but something has to join them when an upload finishes, and leaving it to each
  application proved to be a reliable way to ship a broken editor: the node stays
  at the empty `src` it was inserted with and renders as a broken image forever,
  while the upload reports success. That bug was written twice in this repository
  before this hook existed.

  ```tsx
  const [registry] = useState(() => new MediaUploadRegistry({ uploader }));
  const uploads = useMediaUploads(registry);
  ```

  It also releases each upload once its result is in the document, and destroys
  the registry on unmount — an unreleased preview keeps its blob alive for the
  page's lifetime.

  **`TableControls` and `MediaControls`** complete Milestone 8.4. Both are
  contextual: they render nothing unless they apply, decided by dry-running a
  command rather than by re-implementing the rule. A row of permanently-disabled
  buttons trains people to stop looking at that part of the toolbar.
  `MediaAccessibilityBadge` surfaces the document's alt-text problems, which is
  what makes the gate visible while writing rather than at review.

  **The package now styles its own media node views.** `useMediaNodeViews` creates
  `.docs-editor-media` elements that previously had no dimensions of their own, so
  an image that failed to decode collapsed to nothing and could not be selected.

  **Zoom is now applied, not merely tracked.** `ZoomProvider` holds the factor and
  `ZoomControls` changes it, but _applying_ it is the consumer's job — and
  `<DocsEditor>` was not doing it, so the controls moved a number that scaled
  nothing.

### Patch Changes

- 101c96f: Text/highlight color support and page-view polish.

  - **DOCX colors.** `DocxExporter` now maps a text-color mark to a run `color` and
    a highlight mark's color to a run `shading` fill; `DocxSpec` gains `highlight`,
    `textColor`, and `colorAttr`. HTML and print export already carry colors via
    their inline-style renderers; Markdown remains intentionally lossy (colors
    dropped, text preserved).
  - **Page-view polish (react).** `PageSurface`'s content area now fills the page
    (min-height of one page's content box, laid out as a flex column), so a
    consuming editor can stretch to fill the page and place the caret on a click
    anywhere — reinforcing the "page, not an input field" feel. Purely visual; no
    API change.

  The playground adds a `text_color` mark, gives `highlight` a color, and exposes
  text/highlight color pickers (driven by the core `setMark`), plus removes the
  default contenteditable focus outline and sets a page-appropriate `caret-color`.

- c1e0993: Pin the memory-safety guarantees with regression tests (Phase 6, Milestone 6.5).
  No behaviour or API change — the audit found no leaks, so the deliverable is the
  tests that keep it that way.

  A leak passes every functional test, so these assert the properties directly:

  - undo history discards events beyond its configured depth, and the cap stays
    stable as editing continues (ten times the edits must not mean a deeper stack)
  - repeated view mount/destroy cycles leave no detached editor DOM behind
  - clearing decorations after a view is destroyed is a no-op rather than a throw
    (adapters do this in effect cleanups, which can run post-destroy)
  - live pagination disconnects its `ResizeObserver` and leaves no pending timer
    or animation frame on unmount — a leaked observer would otherwise keep firing
    against a destroyed editor for the life of the page

  Measured in Chromium on a 67-page document: 120 edit/undo cycles grow the heap
  by 0.6 MB (history filling to its cap, then flat) and three full document
  replacements by 0.6 MB, confirming old documents — and the per-node conversion
  cache keyed off them — are collected. See `docs/PERFORMANCE.md`.

- c1e0993: Take live pagination off the per-keystroke path (Phase 6, Milestone 6.4).

  Pagination previously re-flowed pages on every keystroke, costing ~2.8 ms per
  keystroke on a 100-page document. Measuring directly showed the measurement pass
  itself is only ~0.6 ms over 1000 blocks — the cost was _running it that often_.
  It is now debounced to a 120 ms quiet window, with a 500 ms ceiling so sustained
  typing cannot starve it.

  - Pagination cost per keystroke: **2.8 ms → 0.75 ms**
  - Typing on a 67-page document (human speed): 11.45 ms → 9.80 ms per keystroke
  - Trade-off: one-off pagination after importing a 67-page document is slower
    (~220 ms → ~460 ms). Page breaks settle shortly after a pause rather than
    chasing each keystroke, which is how desktop editors behave.

  The measurement pass also now reads `offsetTop`/`offsetHeight` in a single loop
  instead of allocating a `DOMRect` per block into an intermediate array — kept
  because those values are untransformed, so zoom no longer needs a scale
  correction. No API or visible behaviour change beyond the timing.

  See `docs/PERFORMANCE.md` for the numbers and for two optimizations that were
  measured and rejected.

- c1e0993: Lock in the adapter's rendering-efficiency guarantees with regression tests
  (Phase 6, Milestone 6.3). No behaviour or API change.

  Profiling typing on a 1000-paragraph document showed only ~2 ms of a ~12.7 ms
  keystroke is JavaScript we control — the rest is browser layout, paint and
  native `Selection.collapse`. So rather than optimizing the adapter, it was
  audited and confirmed correct, and the two load-bearing properties are now
  covered by tests:

  - the `EditorView` is constructed once and synced via `updateState()` across
    edits, rather than rebuilt
  - inline `nodeRenderers`/`markRenderers`/`keymap` object literals changing
    identity on re-render do not remount the view

  Both would be catastrophic if regressed — dropping DOM selection, IME
  composition and scroll position on every keystroke — while still passing every
  functional test. See `docs/PERFORMANCE.md`.

- Updated dependencies [9949369]
- Updated dependencies [101c96f]
- Updated dependencies [c1e0993]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [c1e0993]
- Updated dependencies [c1e0993]
- Updated dependencies [c1e0993]
- Updated dependencies [e93c738]
- Updated dependencies [a3bb928]
- Updated dependencies [101c96f]
- Updated dependencies [101c96f]
- Updated dependencies [c1e0993]
- Updated dependencies [c1e0993]
  - @sbh321/docs-editor-core@0.1.0
