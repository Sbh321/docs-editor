# Performance

> Baselines, method, and budgets for Docs Editor.
>
> Established in [Phase 6, Milestone 6.1](./ROADMAP.md#phase-6--performance-optimization).

Performance is a feature (PROJECT_SPEC, ARCHITECTURE, CONTRIBUTING all say so),
and ARCHITECTURE's Performance Budget requires it to be *continuously monitored*
— so this document records what was measured, how to reproduce it, and what the
numbers mean. Every later optimization is judged against the baseline here.

The guiding rule from CONTRIBUTING is **measure before optimizing**. Milestone
6.1 deliberately changed no production code: it exists to make performance
observable.

---

## How to reproduce

```bash
pnpm build                 # benchmarks and size measurement need built packages
pnpm bench                 # core micro-benchmarks (Vitest bench)
pnpm size                  # report bundle sizes
pnpm size:check            # enforce the size budgets (what CI runs)
pnpm --filter playground-react test:perf   # real-browser timing + memory

# Why did the bundle grow? Prints the shortest import path to a package:
node scripts/explain-bundle.mjs prosemirror-view
```

Benchmarks live beside the code as `*.bench.ts` and are **never** run by
`pnpm test` — they measure, they don't assert. Browser perf specs are
`*.perf.spec.ts` and are excluded from the normal e2e run.

### Fixtures

All core benchmarks run against deterministic generated documents
(`packages/docs-editor-core/src/benchmarks/fixtures.ts`) so two runs are
comparable — a change in the numbers means a change in the code, not the data.

| Scale | Paragraphs | Structure | Approx. printed length |
| --- | --- | --- | --- |
| `small` | 10 | plain paragraphs | under a page |
| `medium` | 100 | + headings, 1 table/figure/list | ~7 pages |
| `large` | 1000 | + 10 tables/figures/lists | ~67 pages |
| `huge` | 5000 | + 40 tables/figures/lists | ~330 pages |

`large` and `huge` bracket the documented targets: PROJECT_SPEC asks for
"documents exceeding 100 pages" and "thousands of paragraphs".

---

## Baseline — 2026-07-28

Recorded on: Linux, Node v22.23.0, Intel Core i7-13620H (16 threads), 15 GB RAM.
Absolute numbers are machine-specific; **the shape of the curve across scales is
the signal**, and that is what regressions should be judged on.

### Core operations (mean ms/op, jsdom)

Baseline as first measured, and after the Milestone 6.2 fix (lazy, structurally
shared document conversion):

| Operation | | small | medium | large | huge |
| --- | --- | ---: | ---: | ---: | ---: |
| `EditorState.create` | baseline | 0.088 | 0.255 | 1.813 | 7.818 |
| | **after 6.2** | 0.075 | 0.134 | 0.654 | **2.701** |
| `state.tr` (build transaction) | baseline | 0.0017 | 0.0022 | 0.0054 | 0.0226 |
| | **after 6.2** | 0.0015 | 0.0017 | 0.0052 | 0.0199 |
| **`insertText` + `apply` (one keystroke)** | baseline | 0.009 | 0.103 | 1.080 | 4.588 |
| | **after 6.2** | **0.0019** | **0.0023** | **0.0050** | **0.0210** |
| `setSelection` + `apply` (no doc change) | baseline | 0.006 | 0.101 | 0.979 | 4.764 |
| | **after 6.2** | **0.0004** | **0.0004** | **0.0004** | **0.0004** |
| `undo` | baseline | 0.009 | 0.106 | 1.006 | 4.610 |
| | **after 6.2** | 0.0017 | 0.0020 | 0.0049 | 0.0193 |
| `redo` | baseline | 0.008 | 0.103 | 1.007 | 4.720 |
| | **after 6.2** | 0.0018 | 0.0021 | 0.0054 | 0.0185 |

A keystroke on a 5000-paragraph document went from 4.588 ms to 0.021 ms
(**~218× faster**), and a cursor move is now completely flat at 0.0004 ms
regardless of document size (**~11,900× faster at `huge`**) — which is the
correct shape, since moving the cursor edits no content at all.

### Queries (mean ms/op)

| Operation | small | medium | large |
| --- | ---: | ---: | ---: |
| `activeMarks` | 0.0001 | 0.0001 | 0.0001 |
| `activeBlockType` | 0.0002 | 0.0004 | 0.0004 |
| `getOutline` | 0.0007 | 0.010 | 0.111 |
| `findText` | 0.002 | 0.022 | 0.307 |

### Serialization (mean ms/op)

| Operation | small | medium | large |
| --- | ---: | ---: | ---: |
| JSON serialize | 0.006 | 0.066 | 0.737 |
| JSON deserialize (schema-validated) | 0.017 | 0.234 | 2.217 |
| HTML export | 0.182 | 1.677 | 16.50 |
| HTML import (sanitize + validate) | 1.114 | 7.697 | 58.71 |

### Bundle size (gzip)

Published barrels:

| Package | raw | gzip |
| --- | ---: | ---: |
| `docs-editor-core` | 74.5 KB | 17.2 KB |
| `docs-editor-react` | 50.9 KB | 11.7 KB |
| `docs-editor-icons` | 8.9 KB | 1.7 KB |
| `docs-editor-markdown` | 8.1 KB | 2.2 KB |
| `docs-editor-docx` | 9.2 KB | 2.8 KB |

Realistic consumer bundles (minified, `react`/`react-dom` external — these
include the ProseMirror engine, which is what a user actually downloads):

| Scenario | raw | gzip |
| --- | ---: | ---: |
| `createSchema` only | 80.4 KB | 24.4 KB |
| headless: schema + `EditorState` + one command | 237.7 KB | 73.5 KB |
| core: full barrel | 267.1 KB | 82.1 KB |
| **react: `Editor` + `EditorProvider` (minimum real editor)** | 239.4 KB | **74.1 KB** |
| react: full barrel | 306.2 KB | 97.8 KB |
| `docs-editor-markdown` | 223.5 KB | 75.0 KB |
| `docs-editor-docx` | 964.8 KB | 263.1 KB |

### Real-browser interaction (Chromium, playground, pagination enabled)

| Scenario | Baseline | After 6.2 |
| --- | ---: | ---: |
| Typing, 1 paragraph | 2.20 ms/keystroke | ~2.6 ms |
| Typing, 200 paragraphs | 3.42 ms/keystroke | ~3.3 ms |
| Typing, 1000 paragraphs (67 pages) | 9.15 ms/keystroke | ~9.5 ms |
| Typing, 1000 paragraphs, pagination off | — | ~8.8 ms |
| Import 1000 paragraphs + paginate to 67 pages | 217 ms | ~215 ms |

Includes Playwright protocol overhead (roughly 1–2 ms/keystroke), so treat these
as an upper bound on what the editor itself costs. The **trend** is the point.

Note that Milestone 6.2 did **not** move these numbers — see finding 6 below.
Run-to-run variance here is roughly ±1 ms.

---

## What the baseline shows

### 1. `apply()` cost scaled with document size, not change size — fixed in 6.2

A single keystroke costs 0.009 ms on 10 paragraphs and 4.6 ms on 5000 — a ~510×
increase for a change of identical size. Transaction *construction* stays cheap
and near-flat (0.0017 → 0.023 ms), so the cost is in producing the new state.

The decisive evidence is the `setSelection` row: moving the cursor **changes no
document content at all**, yet costs the same 4.8 ms at `huge`. That rules out
document editing as the cause.

Root cause: `EditorState`'s constructor eagerly converts the entire internal
ProseMirror document into a fresh plain `DocumentNode` tree
(`this.doc = engineStateDoc(engine)`), on every state creation — so every
keystroke, every cursor move, and every undo re-walks and re-allocates the whole
document.

This directly contradicted PROJECT_SPEC's "typing performance should never
degrade regardless of document size".

**Fix (Milestone 6.2), in two parts:**

1. `EditorState.doc` is now a lazily-computed, memoized getter, so states created
   for transactions whose document is never read cost nothing.
2. The engine→model conversion walks ProseMirror nodes directly (instead of
   allocating an intermediate `toJSON()` tree and then normalizing it) and
   memoizes per node in a `WeakMap`. ProseMirror documents are persistent — an
   edit reuses the very same child objects for every untouched subtree — so the
   conversion after a small edit only does work along the changed path.

Result: keystroke `apply` at `huge` fell from 4.588 ms to 0.021 ms, and a
selection change is now flat at 0.0004 ms at every scale. Locked in by
`src/state/structural-sharing.test.ts`, which asserts the identity-sharing
properties the optimization depends on, so a refactor cannot silently undo it.

A deliberate bonus: because untouched subtrees now keep their identity,
`state.doc` identity is a valid "did the document change?" signal, so
`React.memo`/`useMemo` over document nodes finally skip work (previously every
node was a fresh object each transaction and memoization could never hit).

### 2. Headless usage pulled in the DOM view — fixed in 6.6

A headless bundle (`createSchema` + `EditorState` + `toggleMark`, no rendering)
resolves to **`prosemirror-view`, `prosemirror-tables`, and `prosemirror-keymap`**
alongside the modules it genuinely needs. That is why "headless state" (73.5 KB)
and "a full React editor" (74.1 KB) weigh almost the same, which they should
not.

Tree-shaking *does* work in general — `createSchema` alone is 24.4 KB vs 82.1 KB
for the full core barrel — so this was a module-graph problem, not a
bundler-configuration one.

**Root cause**, traced with `node scripts/explain-bundle.mjs prosemirror-view`:
`createEngineState` statically imported the table-editing plugin to support a
`tables: true` flag. A reference inside `if (options.tables)` is one no bundler
can prove unreachable, so *every* `EditorState` — table schema or not — dragged
in `prosemirror-tables`, which itself imports `prosemirror-view`.

**Fix (6.6):** table editing moved behind its own entry point and is now passed
in rather than switched on:

```ts
import { EditorState } from "@sbh321/docs-editor-core";
import { tableEditing } from "@sbh321/docs-editor-core/tables";

EditorState.create({ schema, doc, tables: tableEditing });
```

Importing it is what pulls the implementation in, so a document that never uses
tables never pays for them. This is also what CLAUDE.md argues for — plugins
extend the core rather than being baked into it.

| Scenario | Before | After |
| --- | ---: | ---: |
| headless (schema + state + one command) | 73.5 KB | **36.0 KB** (−51%) |
| react: minimum real editor | 74.1 KB | 71.3 KB |
| core: full barrel | 82.1 KB | 79.4 KB |

A breaking change, taken deliberately while the package is pre-release, when it
is cheapest. `scripts/explain-bundle.mjs` remains as the tool for diagnosing the
next such regression: it prints the shortest import path from an entry to any
package, turning "the bundle grew" into a specific import to fix.

### 3. Active-state queries are already free

`activeMarks` and `activeBlockType` — which run on every render of every toolbar
button — are flat at ~0.0001 ms across all scales, because they read only the
nodes around the selection. **Milestone 6.3 needs no memoization for them**; that
work should focus on render frequency instead. Recorded so the effort is not
spent where the data says it is not needed.

### 4. HTML import looked like the most expensive path — under jsdom only

Measured under jsdom, HTML import cost 58.7 ms for a ~67-page document against
2.2 ms for validated JSON import, a 26× gap that made it look like the obvious
optimization target and the deciding factor for streaming.

**That ranking did not survive a real browser** — see finding 11. jsdom's DOM
implementation is far slower than a browser's, so it inflates precisely the
formats that touch the DOM. The conclusion was wrong, not just imprecise.

### 5. DOCX must stay lazy-loaded

At 263 KB gzip, `docs-editor-docx` is ~3.5× the entire React editor — dominated
by `docx` and `mammoth`. The playground already loads it through a dynamic
`import()`, and the package README documents that pattern. The measurement
confirms that decision rather than changing it.

### 6. Browser typing on large documents is bound elsewhere — 6.3/6.4 work

Milestone 6.2 made the core ~218× faster per keystroke, yet **real-browser
typing at 1000 paragraphs did not improve** (~9 ms/keystroke before and after).
That is not a contradiction: it means `EditorState.apply` was never the browser
bottleneck at that scale — it is now simply not on the critical path at all
(0.005 ms of a ~9 ms budget).

Two suspects were measured and ruled out:

- **Live pagination** — measured directly by re-running with it disabled:
  ~8.8 ms vs ~9.5 ms, so pagination costs roughly **0.7 ms/keystroke**. Its
  convergent design and per-frame coalescing are holding up; incremental
  measurement (6.4) is a smaller win than expected.
- **The playground's debug document preview**, which re-renders the whole node
  tree — memoizing it on node identity (now possible thanks to 6.2) changed
  nothing measurable.

What remains is ProseMirror's own DOM reconciliation plus browser layout for a
67-page document. Attributing that properly needs real browser profiling rather
than elimination — done in finding 7.

### 7. Typing on large documents is layout-bound, not JS-bound (6.3)

A V8 sampling profile (`pnpm --filter playground-react test:perf`, the
`CPU profile` spec) of 60 keystrokes on a 1000-paragraph document attributes the
cost as:

| Bucket | Share of a ~12.7 ms keystroke |
| --- | ---: |
| `(program)` — browser internals: layout, paint, event dispatch | ~4.4 ms |
| `collapse` (native DOM `Selection.collapse`) | ~3.1 ms |
| Application + library JS (ProseMirror, React, docs-editor) | **~2.0 ms** |
| GC and idle | ~0.7 ms |

Only about **2 ms per keystroke is JavaScript we control**. The dominant cost is
the browser laying out a very tall document and re-syncing the DOM selection
after each edit — `Selection.collapse` alone forces a synchronous reflow.

Consequences, all evidence-based rather than assumed:

- **Milestone 6.3 needs no adapter optimization.** Combined with finding 3
  (active-state queries are already free), there is no meaningful JS to remove.
  The adapter was audited instead and confirmed correct: the view is constructed
  once and synced with `updateState`, and renderer maps/keymap are captured at
  mount so inline object literals cannot remount it. Both properties are now
  locked by regression tests in `editor.test.tsx`, because breaking them would
  be catastrophic (dropping DOM selection and IME state on every keystroke)
  while still passing every functional test.
- **The only real lever on the remaining cost is rendering less DOM**, which is
  the viewport-virtualization question deferred to Milestone 6.4 — and this is
  the data that decision should be made on.

### 8. Live pagination costs ~2.8 ms/keystroke at human typing speed

The earlier "pagination is only ~0.7 ms" measurement was an artifact of typing
as fast as the harness allows: pagination measurement is coalesced to one pass
per animation frame, so a full-speed burst collapses many keystrokes into a
handful of measurements.

Re-measured with 80 ms between keystrokes (roughly a fast human typist), on 1000
paragraphs:

| Pagination | Work per keystroke |
| --- | ---: |
| ON | 11.45 ms |
| OFF | 8.65 ms |

So live pagination genuinely costs about **2.8 ms per keystroke** — roughly a
quarter of the total — because each pass measures every top-level block. That
makes incremental measurement (cache block heights, re-measure only from the
first changed block downward) a real win, and confirms Milestone 6.4's scope.

Method note: benchmarks that hammer input as fast as possible can *hide* costs
that are coalesced per frame. Measure at realistic interaction speed when the
work under test is frame-scheduled.

### 9. Pagination was scheduling-bound, not measurement-bound (6.4)

The obvious assumption was that re-measuring every block is what costs 2.8 ms.
Measured directly in-page over the real rendered document (the
`cost of one pagination measurement pass` spec), one full pass over **1000
blocks takes 0.61 ms** — nowhere near the per-keystroke cost. The expense was
running that pass, applying decorations, and reflowing *on every keystroke*.

Fix: re-paginate when typing **pauses** (120 ms of quiet) rather than on every
keystroke, with a 500 ms ceiling so sustained input cannot starve it.

| Metric (1000 paragraphs / 67 pages) | Before | After |
| --- | ---: | ---: |
| Pagination cost per keystroke (human speed) | 2.80 ms | **0.75 ms** |
| Typing with pagination on (human speed) | 11.45 ms | 9.80 ms |
| Initial pagination after import | ~220 ms | ~460 ms |

A deliberate trade: one-off import pagination got slower so that continuous
typing got faster, which is the right direction given PROJECT_SPEC's "typing
performance should never degrade". Page breaks now settle ~120 ms after a pause
instead of chasing every keystroke — imperceptible, and how desktop editors
behave.

Two things measured and **rejected**, recorded so they are not re-attempted:

- **`offsetTop`/`offsetHeight` instead of `getBoundingClientRect()` for speed.**
  Folklore says the rect call is slower; over 1000 blocks it measured *faster*
  (0.61 ms vs 0.73 ms). The offset-based reads were kept anyway, but for a
  different and honest reason — they are untransformed, so zoom needs no scale
  correction — not for performance.
- **Fast-pathing the convergence pass** (skipping the debounce for the resize
  our own break spacing causes, to recover the slower import). It let the
  measure → apply → observe cycle re-enter without settling, leaving content
  permanently in motion — Playwright could not even click a "stable" element,
  timing out after 30 s — and it gave back most of the per-keystroke win.
  Uniform debouncing is what makes the loop quiesce.

### 10. Memory is stable over long sessions (6.5)

ARCHITECTURE requires memory to "grow predictably" with no leaks, no retained
detached DOM and no unbounded history — properties that no functional test would
ever catch. Measured in Chromium against a 1000-paragraph (67-page) document,
forcing a collection before each reading:

| Scenario | Heap before | Heap after | Growth |
| --- | ---: | ---: | ---: |
| 120 edit/undo cycles | 8.8 MB | 9.4 MB | +0.6 MB (4.8 KB/cycle) |
| 3 full document replacements | 6.9 MB | 7.5 MB | +0.6 MB |

Both are bounded rather than accumulating. The per-cycle growth is the undo
history filling to its cap and then plateauing — exactly the intended behaviour.
That document replacement costs ~0.6 MB across three rounds (when a single
document of this size is itself several MB) confirms old documents are collected
— including the per-node conversion cache added in 6.2, whose `WeakMap` keys
become unreachable with the engine nodes they key on.

A whole 67-page document costs roughly 9 MB of heap.

Backed by regression tests rather than one-off measurements:
`state/memory-bounds.test.ts` pins the history depth cap and view teardown
(repeated mount/destroy leaves no DOM, and clearing decorations after destroy is
a no-op rather than a throw), and `page/pagination-cleanup.test.tsx` pins that
live pagination disconnects its `ResizeObserver` and leaves no pending timer or
animation frame on unmount — a leaked observer there would keep firing against a
destroyed editor for the life of the page.

### 11. Serialization does not need streaming — measured in a browser (6.7)

End-to-end, user-visible latency in Chromium for a 1000-paragraph (67-page)
document. These include everything a user actually waits for — serialization,
React re-render, editor remount and re-pagination — not just the codec:

| Format | Export | Import |
| --- | ---: | ---: |
| JSON | 91 ms (178 KB) | 114 ms |
| HTML | 70 ms (71 KB) | 81 ms |
| Markdown | 81 ms (66 KB) | 87 ms |
| DOCX | 187 ms (incl. lazy-loading the package) | — |

Two conclusions:

**jsdom inverted the ranking.** Under jsdom, HTML import cost 26× validated JSON
import and looked like the clear bottleneck (finding 4). In a browser, HTML is
the *fastest* of the three formats and JSON the slowest — native DOM parsing is
quick, while JSON's larger payload (178 KB vs 71 KB) costs more to parse and
re-validate through the schema. Benchmarking DOM-touching code under jsdom
measures jsdom.

**Streaming and chunked execution stay deferred**, now on evidence rather than
preference. Every format completes an explicit, user-triggered operation on a
67-page document in well under 200 ms — far below the ~1 s at which a user needs
progress feedback or cancellation. Extrapolating linearly, the `huge` scale
(~330 pages) lands around 400–500 ms, still acceptable.

*Revisit if* a real document pushes import or export past **~500 ms** — roughly
300 pages and up — at which point progress reporting and cancellation matter
more than raw throughput. The Phase 5.7 contracts are already async-tolerant, so
that stays additive rather than a redesign.

No serialization inefficiency was fixed here, because the one that existed had
already been removed: the engine→model conversion used to traverse and allocate
the whole document twice (`toJSON()`, then normalize), fixed in 6.2.

---

## Budgets

Size budgets are **enforced in CI** — `pnpm size:check` fails the build on a
breach, and the failure message points at
`node scripts/explain-bundle.mjs <package>` to find what pulled the weight in.
They live in `scripts/measure-bundle-size.mjs`, roughly 10–20% above the
measured baseline: loose enough not to trip on ordinary work, tight enough to
catch a real regression.

The timing budgets below are **not** gated, deliberately. Bundle size is
deterministic — the same inputs produce the same bytes — but the timing
benchmarks reach 25% relative margin of error at the largest scale, and worse on
a shared CI runner. Gating on a noisy signal only teaches people to ignore it,
so timings are tracked here and checked by hand when a change needs judging.

Targets were set *before* the optimization work rather than chosen afterwards to
match whatever the result happened to be.

**Enforced in CI** (`pnpm size:check`, gzipped):

| Bundle | Budget | Baseline | Current | Status |
| --- | --- | ---: | ---: | --- |
| Headless (schema + state + command) | ≤ 45 KB | 73.5 KB | 36.0 KB | ✅ fixed in 6.6 |
| Minimum React editor | ≤ 80 KB | 74.1 KB | 71.5 KB | ✅ |
| `createSchema` only | ≤ 24 KB | 24.4 KB | 19.4 KB | ✅ improved in 8.1 |
| core: full barrel | ≤ 90 KB | 82.1 KB | 83.8 KB | ✅ |
| react: full barrel | ≤ 105 KB | — | 98.3 KB | ✅ |
| `docs-editor-core` package output | ≤ 35 KB | 17.2 KB | 32.1 KB | ✅ (raised twice, see below) |
| `docs-editor-react` package output | ≤ 17 KB | 11.7 KB | 15.4 KB | ✅ (raised, see below) |
| `docs-editor-markdown` / `-docx` / `-icons` | ≤ 4 / 5 / 3 KB | — | 3.2 / 3.6 / 1.7 KB | ✅ |
| `docs-editor` (UI) package output | ≤ 8 KB | — | 4.1 KB | ✅ |
| `ui: styled primitives` consumer bundle | ≤ 30 KB | — | 25.4 KB | ✅ |
| `docs-editor-markdown` consumer bundle | ≤ 85 KB | 75.0 KB | 75.7 KB | ✅ |
| `docs-editor-docx` consumer bundle | ≤ 290 KB | 263.1 KB | 267.1 KB | ✅ |
| Editor importing **no** media | ≤ 38 KB | — | 36.1 KB | ✅ |
| The same **plus** the media catalog | ≤ 42 KB | — | 38.3 KB | ✅ |
| `preset: default schema` | ≤ 44 KB | — | 39.6 KB | ✅ |

`ui: styled primitives` is worth reading twice: importing Button, Dialog,
DropdownMenu, Input, Popover, Select and Tooltip costs **25.3 KB** — it does not
pull in the editor, the core, or ProseMirror at all. The styled components are
usable on their own, and an application that wants only a themed dialog does not
download a document engine to get one.

The two media rows are a matched pair, added in 7.7 to make media's cost a measured
number rather than an assurance. The same editing setup, once without media and
once with the node specs, commands, renderers and upload registry, differ by
**2.2 KB gzipped** — and an application that imports no media pays nothing at
all, since the no-media row matches the pre-media `headless state` baseline
(36.0 KB) once its extra history commands are accounted for. That is the
finding-2 property (`prosemirror-tables` shipping to everyone) not repeating.

"Current" is as of the end of Phase 7. The growth since the Phase 6 baselines
is Phase 7's media work: the core's media catalog, commands, upload lifecycle and
serializers; the React node views; and DOCX image embedding. The consumer-bundle
rows moved far less than the package-output rows (`core: full barrel` +0.9 KB
against a package-output +2.7 KB), which is the tree-shaking evidence 6.6 asked
for — an application that imports no media does not pay for it. The
`docs-editor-markdown` +0.7 KB is that package now importing `isSafeMediaUrl` to
refuse unsafe media sources on both export and import.

**Tracked, not gated** (too noisy to fail a build on):

| Metric | Target | Baseline | Current | Status |
| --- | --- | ---: | ---: | --- |
| Keystroke `apply`, `huge` (5000 paragraphs) | < 1 ms | 4.588 ms | 0.021 ms | ✅ fixed in 6.2 |
| Keystroke `apply`, `large` (1000 paragraphs) | < 0.5 ms | 1.080 ms | 0.005 ms | ✅ fixed in 6.2 |
| Selection change (no doc edit), any scale | < 0.1 ms | 4.764 ms | 0.0004 ms | ✅ fixed in 6.2 |
| Active-state query, any scale | < 0.01 ms | 0.0004 ms | 0.0004 ms | ✅ |
| Pagination cost per keystroke (human speed) | < 1 ms | 2.80 ms | 0.75 ms | ✅ fixed in 6.4 |
| Browser typing, 1000 paragraphs | < 8 ms/keystroke | 9.15 ms | ~9.8 ms | ⚠️ layout-bound (see finding 7) |
| Serialization, any format, 67 pages | < 500 ms | — | 70–187 ms | ✅ |
| Heap growth over a long session | bounded | — | +0.6 MB / 120 cycles | ✅ |
| Keystroke `apply`, 200 media | < 1 ms | — | 0.0037 ms | ✅ |
| Keystroke `apply`, 800 media | < 1 ms | — | 0.0089 ms | ✅ |
| `state.doc` read, any media scale | < 0.01 ms | — | 0.00005 ms | ✅ |
| HTML export, 200 media | < 500 ms | — | 10.5 ms | ✅ |
| HTML export, 800 media | < 500 ms | — | 51.3 ms | ✅ |

### Media at scale — Milestone 7.7

Measured with `pnpm --filter @sbh321/docs-editor-core bench media` against
`src/benchmarks/media-fixtures.ts`, whose `hundreds` scale is PROJECT_SPEC's
"hundreds of images" stated literally (200 captioned figures among 400
paragraphs) and whose `extreme` scale is 800.

The Phase 6 budgets hold with media. Typing cost stays essentially flat: 0.0021
ms at 10 media, 0.0037 ms at 200, 0.0089 ms at 800 — a 4.3× spread across an
80× document, against a 1 ms budget, and in line with what the text fixtures
already show for a document of that block count. It is *media-agnostic* growth,
not a media cost. Reading `state.doc` is genuinely flat (~22M ops/s at every
scale), confirming the 6.2 memoization holds when the document is mostly media.

HTML export scales linearly with media count (10.5 ms at 200, 51.3 ms at 800),
which is the expected shape for a whole-document walk and far inside the
serialization budget.

**Loading is the part that does not show up in these numbers.** A benchmark
builds no images, so the real cost of a 200-image document is browser fetch and
decode. That is addressed in the renderers rather than the model: images and
embeds render `loading="lazy"`, images `decoding="async"`, and video/audio
`preload="metadata"` — all overridable through `MediaRendererOptions`, because
**print must pass `loading: "eager"`**. A lazy image that never entered the
viewport may not be fetched before printing, and a missing image in a PDF is a
permanent, silent loss rather than a slow scroll.

### Does the batteries-included layer leak? — Milestone 8.7

Phase 8 added a styled UI, a design-token stylesheet, a default schema and an
assembled `<DocsEditor />`. The whole architecture rests on one claim: **nobody
pays for a layer they do not import.** That is a measurement, not an intention,
so here it is.

| Scenario | Before Phase 8 | End of Phase 8 | Change |
| --- | ---: | ---: | ---: |
| `createSchema` only | 24.5 KB | 19.4 KB | **−5.1** |
| headless state | 36.0 KB | 36.0 KB | 0 |
| editor, no media | 36.1 KB | 36.1 KB | 0 |
| core: full barrel | 83.0 KB | 83.8 KB | +0.8 |
| react: editor only | 71.5 KB | 71.6 KB | +0.1 |
| react: full barrel | 97.4 KB | 98.3 KB | +0.9 |

None of the styled UI, the stylesheet, the default schema or the icons appears
in any of these. The two rows that moved at all did so for reasons unrelated to
the batteries:

- **react: full barrel +0.9 KB** is `useColorScheme` and `useMediaUploads` —
  features added to the *headless* adapter, which a full-barrel import by
  definition includes.
- **`createSchema` only −5.1 KB** is a side effect of adding the `/preset`
  entry point: tsup re-partitioned its shared chunks and the main entry stopped
  carrying code only other entries need.

The layer's own cost, for a consumer who *does* import it, is the
`ui: styled primitives` row: **25.4 KB**, which notably does not include the
editor at all — the styled components tree-shake free of it.

### Budget change log

- **`docs-editor-ui` package output: 18 → 21 KB gzip** (Phase 9, Milestone
  9.11 — the File menu). Import, export in four formats and print moved from
  the playground into `<DocsEditor />`, which is ~2 KB of menu, download and
  format-dispatch wiring in the package output. The numbers that prove the
  cost lands only where it should: `ui: styled primitives` is byte-identical
  at 27.3 KB (a primitives consumer never pays for the editor), and Markdown
  and DOCX stay out of *every* initial bundle — both load dynamically on the
  click that first needs them, the same rule this document already records for
  DOCX.

- **Four package budgets raised** (Phase 9 — Rich Formatting & Interaction):
  `docs-editor-core` 35 → 44 KB, `docs-editor-react` 17 → 20 KB,
  `docs-editor-markdown` 4 → 5 KB, `docs-editor-ui` 12 → 18 KB gzip. Three
  consumer scenarios moved with them: `preset: default schema` 44 → 47 KB,
  `core: full barrel` 90 → 95 KB, `react: full barrel` 105 → 110 KB.

  The phase added paragraph formatting, a font-size mark, a rebuilt link layer,
  task lists and list styles, node movement, drag-and-drop, a listbox `Select`,
  a `Checkbox`, and ten toolbar controls. A phase of that size *not* moving the
  budgets would have been the surprising outcome, so these were raised
  deliberately here rather than left for CI to discover.

  Two numbers are worth reading carefully rather than waving through:

  **The headless rows moved, slightly.** `minimal: headless state` went 36.0 →
  36.5 KB and `minimal: editor, no media` 36.1 → 36.5 KB. Phase 8 recorded that
  these "did not move a byte", so the claim no longer holds and is corrected
  here rather than quietly left standing. The cause is `Transaction`, which every
  headless consumer instantiates: it gained `setNodeType`, and `removeMark` gained
  its all-marks form. Both are primitives the new commands are built on, and
  neither can be tree-shaken out of a class. 0.5 KB for that is a fair price;
  the alternative was a second transaction type nobody would want to learn.

  **`docs-editor-ui` grew most, proportionally** — 11.4 → 15.6 KB, about 37%.
  That package is the *opinionated* layer, so growth there is the least
  concerning kind: nothing reaches a consumer of the headless primitives. The
  `ui: styled primitives` consumer row confirms it, moving 25.4 → 27.3 KB
  against a 30 KB budget while the headless rows above stayed within 0.5 KB.

- **`docs-editor-react` package output: 15 → 17 KB gzip** (Phase 8, colour-scheme
  resolution). `ThemeProvider` gained light/dark resolution and `useColorScheme`,
  which is ~0.9 KB. Raised rather than absorbed because it is a real feature, and
  the consumer row moved correspondingly little: `react: full barrel` went 97.4 →
  97.9 KB against a 105 KB budget.

- **`docs-editor-core` package output: 30 → 35 KB gzip** (Phase 8, the preset).
  The gate caught the new `/preset` entry point, which emits a third bundle
  (~4.6 KB gzip) containing the default schema, renderers, parse rules and
  keymap. Raised because it is a *separate entry point*: nothing reaches a
  consumer who does not import it, and the consumer rows prove that — `core:
  full barrel` is unchanged at 83.8 KB, and a consumer who *does* import the
  preset pays 39.6 KB, only 1.3 KB more than the media-enabled setup it shares
  most of its code with.

  The same change **improved** `createSchema only` from 24.5 to 19.4 KB, so its
  budget was tightened 30 → 24 KB. Adding a third entry made tsup re-partition
  its shared chunks, and the main entry stopped carrying code only the other
  entries need. That was a side effect, not a goal — recorded because an
  unexplained 5 KB drop is exactly as suspicious as an unexplained rise.

- **`docs-editor-core` package output: 23 → 30 KB gzip** (Phase 7, media). The
  gate caught the media module landing in core — 19.3 → 23.8 KB — which is the
  process working: growth had to be justified rather than absorbed silently.
  Raised because the *consumer* numbers show nobody pays for it unless they use
  it: `schema only` moved 24.4 → 24.5 KB and `headless state` stayed at exactly
  36.0 KB, so media tree-shakes cleanly and does not become the next
  `prosemirror-tables` (finding 2). The consumer bundles, not the package total,
  are the meaningful guard; the package total is a growth tripwire.

The one target not met is browser typing on a 67-page document. Finding 7 shows
why it is not an optimization target: only ~2 ms of it is JavaScript we control,
and the rest is browser layout and native selection sync. Closing it would mean
rendering less DOM — viewport virtualization — which is deferred on the grounds
in finding 6.4.

---

## Method notes and caveats

- **Absolute numbers are machine-specific.** Compare curves and ratios across
  scales, and compare a change against a baseline captured on the same machine.
- **jsdom is not a browser.** The core micro-benchmarks measure algorithmic cost
  (traversal, allocation, validation), not real layout or paint. That is why the
  browser interaction specs exist alongside them. For anything that touches the
  DOM this is not a small correction — under jsdom it reversed which
  serialization format was slowest (finding 11), so **treat jsdom numbers for
  HTML export/import as indicative only** and take the browser specs as
  authoritative.
- **The `large`-scale serialization benchmarks are noisy.** Each iteration takes
  tens of milliseconds, so a run collects only ~10–30 samples and relative
  margins of error reach 25%; successive runs of HTML import at `large` ranged
  59–100 ms. They are good for catching a gross regression, not for comparing
  two runs. Prefer the `medium` scale (thousands of samples, ~1% RME) or the
  browser specs when a change needs to be judged.
- **`state.apply` is measured from a fixed base state**, so each sample is
  exactly one keystroke rather than an accumulating document.
- **Fixtures are memoized per scale.** Building a 5000-paragraph document
  validates every node through the schema and is far too slow to repeat inside a
  benchmark loop; documents are immutable, so sharing one instance is safe.
- **Interaction timings include harness overhead** and vary with machine load;
  the perf specs run serially for that reason.
