---
"@sbh321/docs-editor-core": minor
---

Add the media foundation to the core (Phase 7 — Media, Milestones 7.1–7.4):
images, video, audio, file attachments and embeds on one shared model, with the
asynchronous upload lifecycle a real editor needs.

**Model** — `mediaNodeSpecs()` returns reusable `NodeSpec`s to spread into your
schema, so the core supplies media *shapes* without imposing a document schema.
A generalized `figure`/`caption` accepts any media type through a shared `media`
group, including types you add yourself. A shared attribute vocabulary covers
`src`, `alt`, `title`, `width`, `height`, `align`, a stable `mediaId`, and an
explicit `decorative` flag (distinct from an author's accidentally-empty `alt`).

**Commands** — `insertMedia` (optionally wrapping in a captioned figure),
`setMediaAttrs`, `setMediaAlignment`, `setMediaSize`, `setMediaAlt`, and
`removeMedia`. Removing media also removes a wrapping figure when the figure
could not legally survive losing it, decided by asking the schema rather than by
hardcoding structure.

**Uploads** — a `MediaUploader` contract the application implements, driven by a
`MediaUploadRegistry` that tracks progress, cancellation, retry and local
previews. Upload state lives outside the document, so placeholders never enter
undo history and a document can never be serialized mid-upload.
`applyMediaUploadResult` writes the result back by locating the node via its
`mediaId` — not a remembered position, which is stale as soon as the user types
above it.

**Ingestion** — `acceptMediaFiles`, `planMediaInsert`, `mediaTypeForFile`,
`mediaTypeForUrl` and `isSafeMediaUrl`: pure policy functions with no DOM
dependency, so event wiring stays in the adapter and all of it is testable
without a browser. Nothing fetches — a pasted URL is classified by inspecting
the string, never by requesting it.

Also adds two primitives that are not media-specific:
`Transaction.setNodeAttrs(pos, attrs)` for changing a node's attributes in
place, and a `selectedNode(state)` query returning the node selected as a unit
along with its parent.

Fixes a latent core bug found along the way: a node declaring several
whitespace-separated groups (`group: "block media"`) was treated as belonging to
one group literally named `"block media"`, so multi-group nodes matched no
content expression. Group lists are now split, matching the engine's own
semantics, and `nodeGroups` is exported.
