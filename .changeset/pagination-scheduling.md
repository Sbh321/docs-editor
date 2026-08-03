---
"@sbh321/docs-editor-react": patch
---

Take live pagination off the per-keystroke path (Phase 6, Milestone 6.4).

Pagination previously re-flowed pages on every keystroke, costing ~2.8 ms per
keystroke on a 100-page document. Measuring directly showed the measurement pass
itself is only ~0.6 ms over 1000 blocks — the cost was *running it that often*.
It is now debounced to a 120 ms quiet window, with a 500 ms ceiling so sustained
typing cannot starve it.

- Pagination cost per keystroke: **2.8 ms → 0.75 ms**
- Typing on a 67-page document (human speed): 11.45 ms → 9.80 ms per keystroke
- Trade-off: one-off pagination after importing a 67-page document is slower
  (~220 ms → ~460 ms). Page breaks settle shortly after a pause rather than
  chasing each keystroke, which is how desktop editors behave.

The measurement pass also now reads `offsetTop`/`offsetHeight` in a single loop
instead of allocating a `DOMRect` per block into an intermediate array — kept
because those values are untransformed, so zoom no longer needs a scale
correction. No API or visible behaviour change beyond the timing.

See `docs/PERFORMANCE.md` for the numbers and for two optimizations that were
measured and rejected.
