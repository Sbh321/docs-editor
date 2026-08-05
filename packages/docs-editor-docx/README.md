# @sbh321/docs-editor-docx

DOCX (Microsoft Word) import/export for [Docs Editor](../../README.md).

> **Status:** [Phase 5.7 — DOCX Import & Export](../../docs/ROADMAP.md#phase-57--docx-import--export).
> Provides `DocxExporter` and `DocxImporter`.

## Package boundary

Like [`@sbh321/docs-editor-markdown`](../docs-editor-markdown/README.md), this
package works entirely over the **public** document model (`DocumentNode` +
`Schema`) and never touches ProseMirror. `.docx` is translated *in* and *out* —
the internal model stays authoritative.

Because `.docx` is **binary** (a ZIP of Office Open XML) and the mapping
libraries are **asynchronous**, both classes use the generalized serialization
contracts from the core:

- `DocxExporter` is a `DocumentExporter<NodeName, Promise<Uint8Array>>`
- `DocxImporter` is a `DocumentImporter<NodeName, ArrayBuffer | Uint8Array, Promise<DocumentNode>>`

They are therefore **not** registered on the synchronous, string-typed
`SerializationRegistry` — they're used directly.

## Dependencies

- **[`docx`](https://github.com/dolanmiu/docx)** — builds the `.docx` for export.
- **[`mammoth`](https://github.com/mwilliamson/mammoth.js)** — converts `.docx`
  to HTML for import.

## Export

```ts
import { DocxExporter } from "@sbh321/docs-editor-docx";

const bytes = await new DocxExporter().serialize(doc); // Uint8Array
// In a browser: download it.
const blob = new Blob([bytes], {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});
```

A `DocxSpec` (like `MarkdownSpec`) maps your schema's type names to their DOCX
meaning; it defaults to the common Docs Editor names, so most schemas need no
configuration.

Faithful within what DOCX and this mapping express: headings, paragraphs,
blockquotes, bullet/ordered lists, code blocks, dividers, tables, and the
bold/italic/underline/strikethrough/code/link marks, plus **text color** (run
`color`) and **highlight color** (run `shading` fill).

### Images

Images embed for real when you supply an asset resolver. The exporter asks for
bytes and never fetches them itself — the same boundary as media upload, since
retrieving them means credentials, CORS and caching:

```ts
const exporter = new DocxExporter({
  resolveAsset: async (src) => {
    const response = await fetch(src);
    return response.ok ? { data: new Uint8Array(await response.arrayBuffer()) } : null;
  },
});
```

Each distinct source is resolved once. Returning `null` — or throwing — is a
normal outcome, not a failure: that image degrades to its alt text and the rest
of the document still exports.

**Documented lossy cases:** without a resolver, images fall back to alt text;
video, audio, attachments and embeds degrade to their inline text; unknown block
nodes degrade to their inline text. Colors are carried on export; whether they
survive a re-import depends on `mammoth`.

## Import

```ts
import { DocxImporter } from "@sbh321/docs-editor-docx";

const importer = new DocxImporter({ schema, parseSpec });
const doc = await importer.parse(fileBytes); // ArrayBuffer or Uint8Array
```

Import is **secure by construction**: `mammoth` converts the `.docx` to plain
HTML, which is fed through the core `HtmlImporter` — the HTML is sanitized
(dangerous elements/attributes removed, `javascript:` URLs stripped) and rebuilt
through the schema. There is no second parsing/sanitization surface. Because
`mammoth` emits standard HTML (`h1`–`h6`, `p`, `ul`/`ol`/`li`, `strong`, `em`,
`a`, `table`, …), the **same** `HtmlParseSpec` you use for HTML import drives
DOCX import.

> Note: `mammoth`'s default conversion omits some inline styling (e.g. underline)
> — those degrade on import. Pass a `styleMap` to customize the mapping.

## Bundle size

`docx` and `mammoth` are sizable. In a browser app, load this package lazily —
e.g. `const { DocxExporter } = await import("@sbh321/docs-editor-docx")` behind
the user's export/import action — so it stays out of your main bundle (the
playground does exactly this).
