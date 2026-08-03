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
| Minimum React editor | ≤ 80 KB | 74.1 KB | 71.3 KB | ✅ |
| `createSchema` only | ≤ 30 KB | 24.4 KB | 24.4 KB | ✅ |
| core: full barrel | ≤ 90 KB | 82.1 KB | 79.4 KB | ✅ |
| react: full barrel | ≤ 105 KB | — | 95.1 KB | ✅ |
| `docs-editor-core` package output | ≤ 23 KB | 17.2 KB | 19.3 KB | ✅ |
| `docs-editor-react` package output | ≤ 15 KB | 11.7 KB | 11.7 KB | ✅ |
| `docs-editor-markdown` / `-docx` / `-icons` | ≤ 4 / 5 / 3 KB | — | 2.2 / 2.8 / 1.7 KB | ✅ |
| `docs-editor-markdown` consumer bundle | ≤ 85 KB | 75.0 KB | 75.0 KB | ✅ |
| `docs-editor-docx` consumer bundle | ≤ 290 KB | 263.1 KB | 263.1 KB | ✅ |

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
