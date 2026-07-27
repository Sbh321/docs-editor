---
"@sbh321/docs-editor-docx": minor
"@sbh321/docs-editor-core": minor
---

Phase 5.7 — DOCX (Microsoft Word) import/export, delivered as the additive
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
