# @sbh321/docs-editor-markdown

Markdown import/export for [Docs Editor](../../README.md).

> **Status:** [Phase 5 — Import & Export](../../docs/ROADMAP.md#phase-5--import--export),
> Milestone 5.4. Provides `MarkdownExporter` and `MarkdownImporter`.

## Package boundary

This package works entirely over the **public** document model —
`DocumentNode` and `Schema` from `@sbh321/docs-editor-core` — and never touches
ProseMirror. It cannot use `prosemirror-markdown`, because that library needs
the compiled ProseMirror schema, which the core deliberately hides. Instead the
importer uses [`markdown-it`](https://github.com/markdown-it/markdown-it) to
tokenize Markdown and rebuilds the tree *through the schema*, so imported
documents are validated like every other import; the exporter walks the plain
`DocumentNode` tree directly.

## Schema mapping

Both the exporter and importer take a `MarkdownSpec` that maps a schema's
node/mark *type names* to their Markdown meaning. Different schemas name types
differently (`bold` vs `strong`, `divider` vs `horizontal_rule`), so the mapping
is explicit — defaulting to the common names used across the Docs Editor
examples (`defaultMarkdownSpec`).

```ts
import { resolveMarkdownSpec } from "@sbh321/docs-editor-markdown";

// Override only what differs from the defaults.
const spec = resolveMarkdownSpec({
  marks: { bold: "strong" },
  nodes: { horizontalRule: "horizontal_rule" },
});
```

## Export

```ts
import { MarkdownExporter } from "@sbh321/docs-editor-markdown";

const exporter = new MarkdownExporter();
const markdown = exporter.serialize(doc); // doc: DocumentNode
```

Markdown is intentionally lossy: only what Markdown can express survives
(headings, paragraphs, blockquotes, bullet/ordered lists, code blocks,
horizontal rules, and the bold/italic/inline-code/link marks). Anything else a
schema models degrades gracefully — unknown block nodes render their inline
text, and unknown marks are dropped rather than corrupting the output. Markdown
special characters in text are backslash-escaped so they can't trigger unwanted
formatting on re-parse.

## Import

```ts
import { MarkdownImporter } from "@sbh321/docs-editor-markdown";

const importer = new MarkdownImporter(schema);
const doc = importer.parse("# Title\n\nHello **world**"); // validated DocumentNode
```

`markdown-it` is configured with `html: false`, so raw HTML embedded in the
Markdown is carried through as inert literal text rather than parsed — arbitrary
HTML is never executed. This upholds the project's serialization security rule:
never execute arbitrary HTML, and validate imported documents.

## Registration

Both classes implement the `DocumentExporter` / `DocumentImporter` contracts
from the core, so they can be registered on a `SerializationRegistry`:

```ts
import { SerializationRegistry } from "@sbh321/docs-editor-core";
import { MarkdownExporter, MarkdownImporter } from "@sbh321/docs-editor-markdown";

const registry = new SerializationRegistry()
  .registerExporter(new MarkdownExporter())
  .registerImporter(new MarkdownImporter(schema));

const markdown = registry.export("markdown", doc);
const roundTripped = registry.import("markdown", markdown);
```
