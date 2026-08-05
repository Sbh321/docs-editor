---
"@sbh321/docs-editor-core": minor
"@sbh321/docs-editor-react": minor
---

Add a node-view API and interactive media rendering with drag-to-resize
(Phase 7 — Media, Milestone 7.5).

**Core** gains a documented node-view API — `NodeViewFactory`, `NodeViewSpec`,
`NodeViewContext` — and a `nodeViews` option on `EditorView` (and on React's
`<Editor>`). `nodeRenderers` answers "what DOM does this node produce?", which
is enough for static content but not for a node the user manipulates directly:
a resizable image needs its own element, lifecycle, and the ability to keep its
chrome out of the editor's mutation handling. A node view takes precedence over
a renderer for the same type.

The interface is a small, documented subset of the engine's own view protocol,
so no ProseMirror type crosses the package boundary. `getPos` is a function
rather than a value because a node moves as the document is edited — the same
staleness trap `mediaId` avoids for uploads.

**React** gains `createMediaNodeViews` / `useMediaNodeViews`: node views for
image, video, audio, file and embed, with corner handles that resize by drag.
Resizing previews live by styling only and writes to the document once on
release, so a drag produces one undo step rather than dozens. Images get
`loading="lazy"` and `decoding="async"`, and embeds are sandboxed.
