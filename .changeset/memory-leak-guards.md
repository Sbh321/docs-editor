---
"@sbh321/docs-editor-core": patch
"@sbh321/docs-editor-react": patch
---

Pin the memory-safety guarantees with regression tests (Phase 6, Milestone 6.5).
No behaviour or API change — the audit found no leaks, so the deliverable is the
tests that keep it that way.

A leak passes every functional test, so these assert the properties directly:

- undo history discards events beyond its configured depth, and the cap stays
  stable as editing continues (ten times the edits must not mean a deeper stack)
- repeated view mount/destroy cycles leave no detached editor DOM behind
- clearing decorations after a view is destroyed is a no-op rather than a throw
  (adapters do this in effect cleanups, which can run post-destroy)
- live pagination disconnects its `ResizeObserver` and leaves no pending timer
  or animation frame on unmount — a leaked observer would otherwise keep firing
  against a destroyed editor for the life of the page

Measured in Chromium on a 67-page document: 120 edit/undo cycles grow the heap
by 0.6 MB (history filling to its cap, then flat) and three full document
replacements by 0.6 MB, confirming old documents — and the per-node conversion
cache keyed off them — are collected. See `docs/PERFORMANCE.md`.
