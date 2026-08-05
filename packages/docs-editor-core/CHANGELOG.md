# @sbh321/docs-editor-core

## 0.1.0

### Minor Changes

- 9949369: Add the default preset — `@sbh321/docs-editor-core/preset` (Phase 8 — Batteries-
  Included Editor, Milestone 8.1).

  Until now the only complete schema in the repository was example code inside the
  playground, so assembling an editor meant writing ~250 lines of schema,
  renderers and parse rules before anything appeared on screen. This is that
  configuration, shipped:

  ```ts
  import { EditorState } from "@sbh321/docs-editor-core";
  import { defaultSchema, defaultKeymap } from "@sbh321/docs-editor-core/preset";

  const state = EditorState.create({ schema: defaultSchema, doc, history: true });
  ```

  `defaultSchema` covers prose, headings, lists, quotes, code, dividers, media,
  tables and the formatting marks including colour and font. `defaultNodeRenderers`,
  `defaultMarkRenderers`, `defaultParseSpec` and `defaultKeymap` go with it, and
  `extendDefaultSchema()` adds your own types without disturbing the defaults.

  The renderers and parse rules ship together because they must stay inverses of
  each other: the renderers drive the live view, HTML export _and_ print, and
  maintaining those as separate maps is how exported markup quietly stops matching
  what is on screen.

  Its type names match `defaultMarkdownSpec` and `defaultDocxSpec`, so documents
  built on this schema export to every format with no mapping configuration.

  A **separate entry point**, like `/tables`: importing it is what pulls it into
  your bundle, so a consumer with their own schema pays nothing. It is
  framework-agnostic — no React — so a server render or a future adapter can use
  it too.

  These type names are a public API: a document saved against `defaultSchema`
  today must still load tomorrow.

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

- 9949369: Add the media foundation to the core (Phase 7 — Media, Milestones 7.1–7.4):
  images, video, audio, file attachments and embeds on one shared model, with the
  asynchronous upload lifecycle a real editor needs.

  **Model** — `mediaNodeSpecs()` returns reusable `NodeSpec`s to spread into your
  schema, so the core supplies media _shapes_ without imposing a document schema.
  A generalized `figure`/`caption` accepts any media type through a shared `media`
  group, including types you add yourself. A shared attribute vocabulary covers
  `src`, `alt`, `title`, `width`, `height`, `align`, a stable `mediaId`, and an
  explicit `decorative` flag (distinct from an author's accidentally-empty `alt`).

  **Commands** — `insertMedia` (optionally wrapping in a captioned figure),
  `setMediaAttrs`, `setMediaAlignment`, `setMediaSize`, `setMediaAlt`, and
  `removeMedia`. Removing media also removes a wrapping figure when the figure
  could not legally survive losing it, decided by asking the schema rather than by
  hardcoding structure.

  **Uploads** — a `MediaUploader` contract the application implements, driven by a
  `MediaUploadRegistry` that tracks progress, cancellation, retry and local
  previews. Upload state lives outside the document, so placeholders never enter
  undo history and a document can never be serialized mid-upload.
  `applyMediaUploadResult` writes the result back by locating the node via its
  `mediaId` — not a remembered position, which is stale as soon as the user types
  above it.

  **Ingestion** — `acceptMediaFiles`, `planMediaInsert`, `mediaTypeForFile`,
  `mediaTypeForUrl` and `isSafeMediaUrl`: pure policy functions with no DOM
  dependency, so event wiring stays in the adapter and all of it is testable
  without a browser. Nothing fetches — a pasted URL is classified by inspecting
  the string, never by requesting it.

  Also adds two primitives that are not media-specific:
  `Transaction.setNodeAttrs(pos, attrs)` for changing a node's attributes in
  place, and a `selectedNode(state)` query returning the node selected as a unit
  along with its parent.

  Fixes a latent core bug found along the way: a node declaring several
  whitespace-separated groups (`group: "block media"`) was treated as belonging to
  one group literally named `"block media"`, so multi-group nodes matched no
  content expression. Group lists are now split, matching the engine's own
  semantics, and `nodeGroups` is exported.

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

- 9949369: Media at scale: loading hints, benchmarks and leak coverage (Phase 7 — Media,
  Milestone 7.7).

  `mediaNodeRenderers()` now takes `MediaRendererOptions`. Images and embeds
  render `loading="lazy"`, images `decoding="async"`, and video/audio
  `preload="metadata"`, so a document with hundreds of images does not fetch and
  decode all of them at once. All three are overridable.

  **Pass `loading: "eager"` when exporting for print.** A lazy image that never
  entered the viewport may not be fetched in time for printing, and a missing
  image in a PDF is a permanent, silent loss rather than a slow scroll.

  Adds media-heavy benchmark fixtures reaching PROJECT_SPEC's "hundreds of
  images", measured against the Phase 6 budgets: typing stays flat (0.0037 ms at
  200 media, 0.0089 ms at 800, against a 1 ms budget) and `state.doc` reads are
  scale-independent, confirming the 6.2 memoization holds when a document is
  mostly media.

  Adds object-URL and listener leak coverage for `MediaUploadRegistry` — previews
  revoked on release, cancel, failure and destroy; no accumulation across 50
  upload cycles; a retry reusing its preview rather than allocating a second.

  A matched pair of bundle scenarios now measures what media costs: the same
  editing setup with and without the media catalog differs by 2.1 KB gzipped, and
  an application importing no media pays nothing.

- 9949369: Serialize media across every format (Phase 7 — Media, Milestone 7.6).

  **Core** gains `mediaNodeRenderers()` and `mediaHtmlParseRules()` — ready-made
  HTML rendering and parsing for image, video, audio, file and embed, plus figure
  and caption. Both are ordinary `NodeRenderer`/`HtmlParseSpec` values, generic
  over the consuming schema's node names, so they can be spread and individually
  overridden. This is what makes HTML export, HTML import, external paste and
  print work for media without every application rewriting the same mapping.

  Sanitization runs in **both** directions. Export refuses to emit an unsafe
  `src`, because a document may have been assembled programmatically or loaded
  from storage predating the importer's checks. Import declines an element whose
  only source is executable, rather than importing a broken empty placeholder.

  **Refines the HTML importer's `data:` URL policy.** It previously stripped every
  `data:` URL, which also removed legitimate inline images. It now allows a
  `data:` URL only where a browser _loads_ the resource (`src`, `poster`) and the
  payload is media. Navigable attributes still refuse it — `data:image/svg+xml` in
  an `href` renders as a document, where script does execute — and `javascript:`
  and `vbscript:` remain blocked everywhere.

  **DOCX images now embed for real**, closing the alt-text fallback documented in
  Phase 5.7. Supply a `resolveAsset` function and the exporter asks it for bytes;
  it never fetches them itself, the same boundary as media upload. Each distinct
  source is resolved once, and a resolver that declines or throws degrades that
  image to alt text rather than failing the export.

  `DocxExporter`'s constructor now takes an options object
  (`new DocxExporter({ spec, resolveAsset })`) rather than a bare spec.

  **Markdown degrades media predictably** instead of dropping it. `image` is
  native (`![alt](src "title")`); video, audio, attachments and embeds become
  links, which is the only construct Markdown still has that carries the media's
  location. Link text comes from the document — `filename`, `alt`, `title`, else
  the URL — never an invented English word. A `figure` flattens to its media plus
  the caption as a paragraph. Media still uploading, or with a source that fails
  `isSafeMediaUrl`, falls back to alt text and emits nothing when there is none.

  On import, `![alt](src)` alone in a paragraph becomes an `image` node; an image
  mixed with text degrades to a link. `MarkdownSpec` gains the media node names
  and the `src`/`alt`/`title`/`filename` attribute names, all defaulted — existing
  partial specs are unaffected.

- e93c738: Phase 4.5 — Polish & Foundation Gaps: close documented-but-missing foundation
  capabilities so the editor behaves like a professional editor out of the box.

  - **Essential editing commands + `baseKeymap`** — `splitBlock`, `joinBackward`/
    `joinForward`, `joinUp`/`joinDown`, `liftEmptyBlock`, `createParagraphNear`,
    `selectNodeBackward`/`selectNodeForward`, `selectParentNode`, and a ready-made
    `baseKeymap` (PM's platform-appropriate bindings as docs-editor `Command`s).
    Spread `baseKeymap` into a view's `keymap` and Enter splits, Backspace/Delete
    join or delete — a working editor from one line.
  - **Node/block selection** — `Selection` now models `type: "node"`;
    `Transaction.selectNode(pos)` selects a whole node (e.g. an image or divider)
    as a unit, and clicking an atomic node round-trips correctly.
  - **`MarkSpec` gains `inclusive?` and `excludes?`** — links can be
    non-inclusive; an inline `code` mark can exclude other formatting.
  - **`removeFormatting`** command — clears every mark across the selection.

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

- 101c96f: Phase 5.7 — DOCX (Microsoft Word) import/export, delivered as the additive
  follow-up the Phase 5 deferral anticipated.

  - **Generalized serialization contracts (core).** `DocumentExporter` and
    `DocumentImporter` are now payload-generic and async-tolerant —
    `DocumentExporter<NodeName, Output = string>` and
    `DocumentImporter<NodeName, Input = string, Result = DocumentNode>`. Fully
    backward compatible: the `string` defaults leave every existing exporter,
    importer, and the synchronous `SerializationRegistry` unchanged. Binary/async
    formats parameterize the payload instead.
  - **New `@sbh321/docs-editor-docx` package.** `DocxExporter` maps the document
    model onto the [`docx`](https://github.com/dolanmiu/docx) library and returns
    `Promise<Uint8Array>`. `DocxImporter` runs `.docx` bytes through
    [`mammoth`](https://github.com/mwilliamson/mammoth.js) (→ HTML) and then the
    core `HtmlImporter`, so DOCX import **inherits HTML import's sanitization and
    schema validation** rather than introducing a second parsing surface. Works
    over the public `DocumentNode` + `Schema` only — never the engine. A `DocxSpec`
    maps schema type names (like `MarkdownSpec`).
  - Faithful within DOCX-expressible, schema-modeled features; documented lossy
    cases (images → alt text; `mammoth`'s default omission of some inline styles)
    are tested, not hidden.
  - Playground: DOCX in the import/export panel — download on export, file-picker
    on import — lazy-loaded via dynamic `import()` so `docx`/`mammoth` stay out of
    the main bundle. End-to-end binary round-trip covered by Playwright.

- 101c96f: Phase 5 — Import & Export: make documents portable while keeping the internal
  model the single source of truth (importers translate _in_, exporters _out_; no
  external format becomes canonical).

  - **Serialization contracts + registry** — `DocumentExporter` /
    `DocumentImporter` and `SerializationRegistry` (`export`/`import` by format,
    `has*`/`*Formats` introspection, actionable duplicate/unknown-format errors).
    Registration is explicit — a new format is additive and never a core change.
  - **JSON** — `JsonExporter` / `JsonImporter` wrap `DocumentSerializer` for an
    exact round-trip; import validates through the schema.
  - **HTML** — `HtmlExporter` reuses the view's `DOMOutputSpec` renderer maps.
    `HtmlImporter` is **sanitized**: the input is loaded into an inert document,
    dangerous elements and `on*`/`javascript:` attributes are stripped, and the
    result is rebuilt through the schema, so arbitrary HTML is never executed.
    A new `HtmlParseSpec` (tag → node/mark rules; `getAttrs` may return `null` to
    decline a match) drives import — also the basis for clean external paste from
    Google Docs / Word.
  - **Print / PDF** — `PrintExporter` emits a standalone HTML document with an
    embedded print stylesheet for `window.print()` (browser print-to-PDF),
    generated from the model so it carries no editor chrome.
  - **Markdown** — new `@sbh321/docs-editor-markdown` package (`MarkdownExporter` /
    `MarkdownImporter`) working over the public `DocumentNode` + `Schema` API,
    faithful within Markdown's expressiveness (lossy cases tested, not hidden).

- c1e0993: **Breaking:** interactive table editing moved behind its own entry point and is
  now passed to `EditorState.create` instead of enabled with a flag
  (Phase 6, Milestone 6.6).

  ```diff
  +import { tableEditing } from "@sbh321/docs-editor-core/tables";
  +
  -EditorState.create({ schema, doc, tables: true });
  +EditorState.create({ schema, doc, tables: tableEditing });
  ```

  Migration is that one import. The table _commands_ (`addRowAfter`,
  `mergeCells`, …) are unchanged and stay on the main entry point.

  **Why.** Supporting `tables: true` required the core to import the table plugin
  unconditionally: a reference inside `if (options.tables)` is one no bundler can
  prove unreachable. So _every_ `EditorState` — table schema or not — pulled in
  `prosemirror-tables` and, through it, `prosemirror-view`. A headless bundle
  weighed almost exactly the same as a full React editor.

  Passing the plugin in means importing it is what pulls the implementation, so a
  document that never uses tables never pays for it:

  | Bundle                                  |     Before |                 After |
  | --------------------------------------- | ---------: | --------------------: |
  | headless (schema + state + one command) | 73.5 KB gz | **36.0 KB gz** (−51%) |
  | minimum React editor                    | 74.1 KB gz |            71.3 KB gz |

  Taken while the package is pre-release, when the change is cheapest, and it is
  the shape `CLAUDE.md` already calls for — plugins extend the core rather than
  being baked into it. The engine boundary is preserved: `EditorPlugin` is opaque
  and its internals are stripped from the published types, so no ProseMirror type
  crosses the package boundary.

  Also adds `scripts/explain-bundle.mjs`, which prints the shortest import path
  from an entry point to any package — turning "the bundle grew" into a specific
  import to fix.

### Patch Changes

- c1e0993: Make `EditorState.doc` lazy and structurally shared, so a keystroke costs
  roughly the size of the change rather than the size of the document
  (Phase 6, Milestone 6.2). Internal only — no public API change.

  Previously `EditorState`'s constructor eagerly converted the entire internal
  ProseMirror document into a fresh plain `DocumentNode` tree, on every state
  creation — so every keystroke, cursor move and undo re-walked and re-allocated
  the whole document. Two changes fix it:

  - `doc` is now a lazily-computed, memoized getter, so states whose document is
    never read cost nothing.
  - The engine-to-model conversion walks ProseMirror nodes directly (instead of
    allocating an intermediate `toJSON()` tree and then normalizing it) and
    memoizes per node in a `WeakMap`. ProseMirror documents are persistent, so an
    edit reuses the identical objects for untouched subtrees and the conversion
    only does work along the changed path.

  Measured on a 5000-paragraph document: applying a keystroke went from 4.588 ms
  to 0.021 ms (~218× faster), and a selection change — which edits no content — is
  now flat at 0.0004 ms at every document size (~11,900× faster). Undo/redo
  improved comparably. See `docs/PERFORMANCE.md`.

  Because untouched subtrees now keep their object identity, `state.doc` identity
  is a reliable "did the document change?" signal, so `React.memo` and `useMemo`
  over document nodes skip work that previously always re-ran.

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

- c1e0993: Add the performance benchmark harness and record the Phase 6 baseline
  (Milestone 6.1). Measurement only — no production code changed and no public
  API affected.

  - Deterministic large-document fixtures (10 / 100 / 1000 / 5000 paragraphs with
    headings, tables, figures, lists and inline marks) so benchmark runs are
    comparable
  - Core micro-benchmarks (`pnpm bench`) covering the keystroke path
    (`state.tr` / `apply`), selection changes, undo/redo, JSON and HTML
    serialization, and the query paths (`findText`, `getOutline`, active state)
  - Bundle-size measurement (`pnpm size`) reporting published barrels and
    realistic minified consumer bundles
  - Real-browser interaction timing via Playwright perf specs, excluded from the
    normal e2e run
  - Baselines, findings and budgets recorded in `docs/PERFORMANCE.md`

  Headline finding: `EditorState.apply` scales with document size rather than
  change size, because the constructor eagerly converts the whole document into a
  fresh plain tree. Addressed in Milestone 6.2.

- c1e0993: Enforce bundle-size budgets in CI (Phase 6, Milestone 6.8). Tooling and
  documentation only — no code or API change.

  - `pnpm size:check` measures every published package and every realistic
    consumer bundle against a gzip budget and exits non-zero on a breach. It runs
    in CI after the build, so a size regression fails the workflow.
  - The failure message points at `node scripts/explain-bundle.mjs <package>`,
    which prints the shortest import path from an entry point to that package —
    turning "the bundle grew" into a specific import to fix.
  - Verified by deliberately breaking a budget and confirming the non-zero exit,
    so the guardrail is known to fire rather than assumed to.

  Only size is gated. The timing benchmarks reach 25% relative margin of error at
  the largest scale and worse on shared CI hardware; gating on a noisy signal
  teaches people to ignore the gate, so timings are tracked in
  `docs/PERFORMANCE.md` and checked by hand instead.

  This completes Phase 6. Highlights across the phase: a keystroke on a
  5000-paragraph document went from 4.588 ms to 0.021 ms, a selection change is now
  flat at 0.0004 ms regardless of document size, headless bundles dropped 51%, and
  live pagination's per-keystroke cost fell 73%.

- c1e0993: Measure serialization performance in a real browser and record the streaming
  decision (Phase 6, Milestone 6.7). Measurement only — no code or API change.

  Adds a Playwright perf spec covering export and import latency for JSON, HTML,
  Markdown and DOCX on a 67-page document. It exists because the jsdom
  micro-benchmarks were misleading for DOM-touching formats: they made HTML import
  look 26× more expensive than JSON import, whereas in a browser HTML is the
  _fastest_ of the three text formats and JSON the slowest.

  Every format completes an explicit, user-triggered operation in under 200 ms, so
  streaming and chunked execution remain deferred, with a documented threshold for
  revisiting (~500 ms, roughly 300+ pages). See `docs/PERFORMANCE.md`.
