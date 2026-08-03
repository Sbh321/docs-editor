---
"@sbh321/docs-editor-core": patch
---

Add the performance benchmark harness and record the Phase 6 baseline
(Milestone 6.1). Measurement only — no production code changed and no public
API affected.

- Deterministic large-document fixtures (10 / 100 / 1000 / 5000 paragraphs with
  headings, tables, figures, lists and inline marks) so benchmark runs are
  comparable
- Core micro-benchmarks (`pnpm bench`) covering the keystroke path
  (`state.tr` / `apply`), selection changes, undo/redo, JSON and HTML
  serialization, and the query paths (`findText`, `getOutline`, active state)
- Bundle-size measurement (`pnpm size`) reporting published barrels and
  realistic minified consumer bundles
- Real-browser interaction timing via Playwright perf specs, excluded from the
  normal e2e run
- Baselines, findings and budgets recorded in `docs/PERFORMANCE.md`

Headline finding: `EditorState.apply` scales with document size rather than
change size, because the constructor eagerly converts the whole document into a
fresh plain tree. Addressed in Milestone 6.2.
