# @sbh321/docs-editor-docx

## 0.1.0

### Minor Changes

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

### Patch Changes

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
