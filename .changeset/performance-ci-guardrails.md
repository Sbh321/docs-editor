---
"@sbh321/docs-editor-core": patch
---

Enforce bundle-size budgets in CI (Phase 6, Milestone 6.8). Tooling and
documentation only — no code or API change.

- `pnpm size:check` measures every published package and every realistic
  consumer bundle against a gzip budget and exits non-zero on a breach. It runs
  in CI after the build, so a size regression fails the workflow.
- The failure message points at `node scripts/explain-bundle.mjs <package>`,
  which prints the shortest import path from an entry point to that package —
  turning "the bundle grew" into a specific import to fix.
- Verified by deliberately breaking a budget and confirming the non-zero exit,
  so the guardrail is known to fire rather than assumed to.

Only size is gated. The timing benchmarks reach 25% relative margin of error at
the largest scale and worse on shared CI hardware; gating on a noisy signal
teaches people to ignore the gate, so timings are tracked in
`docs/PERFORMANCE.md` and checked by hand instead.

This completes Phase 6. Highlights across the phase: a keystroke on a
5000-paragraph document went from 4.588 ms to 0.021 ms, a selection change is now
flat at 0.0004 ms regardless of document size, headless bundles dropped 51%, and
live pagination's per-keystroke cost fell 73%.
