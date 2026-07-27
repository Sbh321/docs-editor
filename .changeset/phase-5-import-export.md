---
"@sbh321/docs-editor-core": minor
"@sbh321/docs-editor-markdown": minor
---

Phase 5 — Import & Export: make documents portable while keeping the internal
model the single source of truth (importers translate *in*, exporters *out*; no
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
