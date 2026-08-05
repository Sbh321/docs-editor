---
"@sbh321/docs-editor": patch
---

Document the batteries-included layer (Phase 8 — Batteries-Included Editor,
Milestone 8.7).

The root README now opens with the three-line quick start rather than a
contributor guide, and adds a "which layer should I use?" table. PROJECT_SPEC
and ARCHITECTURE record the new package, its boundary, and why it is separate
from the React adapter. CLAUDE.md gains the package's responsibilities and the
two dependency directions that must never appear
(`docs-editor-react → docs-editor`, and any CSS framework).

**"Headless first" is now a statement about layers**, not about the absence of a
default — restated in both PROJECT_SPEC and ARCHITECTURE. A styled layer ships
on top so the common case is one import, but it is a separate package a consumer
chooses, and the layer beneath renders no styles and ships no CSS.

PERFORMANCE records the measurement that claim rests on: across all of Phase 8,
the headless bundles did not grow. `headless state` and `editor, no media` are
unchanged to the byte; `react: full barrel` moved +0.9 KB, entirely from
`useColorScheme` and `useMediaUploads` being added to the *headless* adapter.
`createSchema only` actually **shrank** 5.1 KB when the `/preset` entry point
re-partitioned tsup's shared chunks.

The package README adds a migration note: nothing breaks for an application on
the primitives, and `editorTheme` is the cheapest way to adopt the styling
without changing any markup.
