---
"@sbh321/docs-editor-core": minor
---

Add the default preset — `@sbh321/docs-editor-core/preset` (Phase 8 — Batteries-
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
each other: the renderers drive the live view, HTML export *and* print, and
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
