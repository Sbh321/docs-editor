---
"@sbh321/docs-editor-core": minor
---

Media at scale: loading hints, benchmarks and leak coverage (Phase 7 — Media,
Milestone 7.7).

`mediaNodeRenderers()` now takes `MediaRendererOptions`. Images and embeds
render `loading="lazy"`, images `decoding="async"`, and video/audio
`preload="metadata"`, so a document with hundreds of images does not fetch and
decode all of them at once. All three are overridable.

**Pass `loading: "eager"` when exporting for print.** A lazy image that never
entered the viewport may not be fetched in time for printing, and a missing
image in a PDF is a permanent, silent loss rather than a slow scroll.

Adds media-heavy benchmark fixtures reaching PROJECT_SPEC's "hundreds of
images", measured against the Phase 6 budgets: typing stays flat (0.0037 ms at
200 media, 0.0089 ms at 800, against a 1 ms budget) and `state.doc` reads are
scale-independent, confirming the 6.2 memoization holds when a document is
mostly media.

Adds object-URL and listener leak coverage for `MediaUploadRegistry` — previews
revoked on release, cancel, failure and destroy; no accumulation across 50
upload cycles; a retry reusing its preview rather than allocating a second.

A matched pair of bundle scenarios now measures what media costs: the same
editing setup with and without the media catalog differs by 2.1 KB gzipped, and
an application importing no media pays nothing.
