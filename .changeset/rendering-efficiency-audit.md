---
"@sbh321/docs-editor-react": patch
---

Lock in the adapter's rendering-efficiency guarantees with regression tests
(Phase 6, Milestone 6.3). No behaviour or API change.

Profiling typing on a 1000-paragraph document showed only ~2 ms of a ~12.7 ms
keystroke is JavaScript we control — the rest is browser layout, paint and
native `Selection.collapse`. So rather than optimizing the adapter, it was
audited and confirmed correct, and the two load-bearing properties are now
covered by tests:

- the `EditorView` is constructed once and synced via `updateState()` across
  edits, rather than rebuilt
- inline `nodeRenderers`/`markRenderers`/`keymap` object literals changing
  identity on re-render do not remount the view

Both would be catastrophic if regressed — dropping DOM selection, IME
composition and scroll position on every keystroke — while still passing every
functional test. See `docs/PERFORMANCE.md`.
