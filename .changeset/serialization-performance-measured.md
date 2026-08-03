---
"@sbh321/docs-editor-core": patch
---

Measure serialization performance in a real browser and record the streaming
decision (Phase 6, Milestone 6.7). Measurement only — no code or API change.

Adds a Playwright perf spec covering export and import latency for JSON, HTML,
Markdown and DOCX on a 67-page document. It exists because the jsdom
micro-benchmarks were misleading for DOM-touching formats: they made HTML import
look 26× more expensive than JSON import, whereas in a browser HTML is the
*fastest* of the three text formats and JSON the slowest.

Every format completes an explicit, user-triggered operation in under 200 ms, so
streaming and chunked execution remain deferred, with a documented threshold for
revisiting (~500 ms, roughly 300+ pages). See `docs/PERFORMANCE.md`.
