---
"@sbh321/docs-editor-core": minor
"@sbh321/docs-editor-docx": minor
"@sbh321/docs-editor-markdown": minor
---

Serialize media across every format (Phase 7 — Media, Milestone 7.6).

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
`data:` URL only where a browser *loads* the resource (`src`, `poster`) and the
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
