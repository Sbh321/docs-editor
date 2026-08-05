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
horizontal rules, images, and the bold/italic/inline-code/link marks). Anything
else a schema models degrades gracefully — unknown block nodes render their
inline text, and unknown marks are dropped rather than corrupting the output.
Markdown special characters in text are backslash-escaped so they can't trigger
unwanted formatting on re-parse.

### Media

Markdown has syntax for exactly one media type, so the rest degrade to links.
A link is the honest fallback: it is the only construct that still carries the
media's location, so the document stays usable and re-importable instead of
losing the reference.

| Node                              | Markdown                  | Loss                          |
| --------------------------------- | ------------------------- | ----------------------------- |
| `image`                           | `![alt](src "title")`     | Size and alignment            |
| `video`, `audio`, `file`, `embed` | `[label](src "title")`    | Becomes a link; playback/type |
| `figure` + `caption`              | media, then the caption as a paragraph | The pairing      |

The link text is taken from the document — `filename`, then `alt`, then
`title`, falling back to the URL itself. It is never an invented word like
"Video": a serializer has no business inventing prose in one language.

Two cases produce no link at all. Media that is **still uploading** has no URL
yet, and a source that fails the core's `isSafeMediaUrl` check (a
`javascript:` URL reaching a document by some other route) must not become a
link a downstream Markdown renderer would turn into a live anchor. Both fall
back to the node's alt text, and emit nothing when there is none — the
surrounding blocks stay correctly separated either way.

An empty `alt` is emitted as an empty `alt`: `![](src)` is Markdown's way of
saying "no alternative text", which is exactly what a decorative image means.
Substituting a filename there would announce a decorative image to a screen
reader.

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

An `![alt](src)` alone in a paragraph — Markdown's idiom for a standalone image
— is imported as an `image` **node**, since the core models media as blocks. An
image sharing a line with text degrades to a link, the same shape the exporter
uses. Image sources are checked with `isSafeMediaUrl` before becoming a node;
`markdown-it` already refuses dangerous destinations while tokenizing, so this
is defence in depth rather than the only guard.

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
