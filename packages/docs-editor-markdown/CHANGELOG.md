# @sbh321/docs-editor-markdown

## 0.1.0

### Minor Changes

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
