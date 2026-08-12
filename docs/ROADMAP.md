# Docs Editor Roadmap

> Long-term implementation roadmap for Docs Editor.

Version

Status

Owner

Repository

Applies To

Last Updated

Roadmap Horizon

Target Stable Version

Architecture Version

Related Documents

- PROJECT_SPEC.md
- ARCHITECTURE.md
- CONTRIBUTING.md
- CLAUDE.md

---

# Roadmap Philosophy

The roadmap is organized around stable engineering milestones rather than isolated features.

Each milestone should:

- Produce a usable state
- Improve architectural maturity
- Preserve backward compatibility whenever possible
- Avoid unnecessary rewrites
- Prioritize maintainability over speed

No milestone should introduce features that compromise the long-term architecture.

---

# Current Status

Project Phase:

🟢 Phase 0 complete — Phase 1 (Editor Core) in progress: all exit criteria met; stays "In Progress" because plugin architecture/event system are deliberately deferred deliverables (no concrete consumer yet) — 🟢 Phase 2 (React Adapter) complete: state layer (`EditorProvider`, hooks), real `contentEditable` rendering (`EditorView`/`<Editor />`), a Next.js example, and customizable per-node/mark rendering (`nodeRenderers`/`markRenderers`, beyond Phase 2's original scope but built as an immediate follow-up), used across three apps (playground, basic-react, basic-next) — 🟢 Phase 3 (Rich Editing) complete: Milestone 3.1 (headings), 3.2 (quotes), 3.3 (links), 3.4 (keyboard shortcuts), 3.5 (lists), 3.6 (dividers, via a new `Transaction.insertNode()` and the package's first leaf node type), 3.7 (code blocks, via a new `NodeSpec.code` flag + `newlineInCode`/`exitCode`), 3.8 (images, figures & captions — leaf + near-leaf nodes reusing `insertNode()`), 3.9 (copy/paste — native OS clipboard round-trip verified with zero new code), 3.10 (search & replace, via a new pure `findText()` — replace needs no new primitive), and 3.11 (tables — a new `NodeSpec.tableRole`, a `type: "cell"` `Selection` kind for rectangular cell selection, an opt-in `tables` state option installing `prosemirror-tables`' editing plugin, and the row/column/merge/header commands) done, all verified live in the playground — 🟢 Phase 4 (User Interface) complete: a headless UI layer (active-state queries + outline in core; toolbar, floating toolbar, slash/context menus, outline panel, table of contents, zoom controls, and a headless theme provider in the React adapter; plus a new `@sbh321/docs-editor-icons` package), and a decoration/overlay layer (`Decoration` + `EditorView.setDecorations`) that finally paints *visual* search-match highlighting — the one rich-editing item deferred out of Milestone 3.10 — all verified live in the playground with unit and Playwright e2e coverage

Current Version:

v0.1.0 — published to npm on 2026-08-05 (`@sbh321/docs-editor` and its five
supporting packages)

Target First Release:

v0.1.0 ✅

---

# Phase 0 — Project Foundation

Status:

Complete

Objective:

Establish a professional open-source foundation before implementing editor functionality.

Deliverables:

- Repository structure (`apps/`, `packages/`, `examples/`, `tooling/`, `docs/`, `.github/`)
- TurboRepo monorepo
- pnpm workspace
- TypeScript configuration (strict, project references)
- ESLint (flat config)
- Prettier
- Vitest
- Playwright
- Storybook
- Changesets (versioning configured; publishing intentionally deferred, see below)
- Husky + lint-staged + commitlint
- GitHub Actions CI
- Documentation structure
- Example playgrounds (`apps/playground-react`, `examples/basic-react`)

Deferred to a later phase:

- Package publishing pipeline (npm `publish` automation). Changesets is configured for
  versioning, but no package has shipped a release yet — see
  [CONTRIBUTING.md](./CONTRIBUTING.md) and `CLAUDE.md`'s release philosophy.

Exit Criteria:

- Repository builds successfully ✅
- CI passes ✅
- All packages compile ✅
- Documentation structure exists ✅

Target Version:

v0.0.1

---

# Phase 1 — Editor Core

Status:

In Progress

Objective:

Create the core document editing engine.

Deliverables:

- Document model — done (`packages/docs-editor-core/src/schema/`)
- Schema — done. `createSchema()`/`Schema` validate and construct
  `DocumentNode`s and `Mark`s against a `NodeSpec`/`MarkSpec` set; content
  constraints use a sequence + quantifier expression (`paragraph+`,
  `inline*`) that does not yet support alternation/grouping — revisit when
  Phase 3's richer node catalog needs it.
- Engine adapter — done (`packages/docs-editor-core/src/engine/`). Compiles
  a `Schema` into a real `prosemirror-model` schema and converts
  `DocumentNode`/`Mark` to and from ProseMirror's node representation.
  Fully internal: nothing under `src/engine/` is exported from the package,
  and an ESLint rule fails the build if any other file imports a
  `prosemirror-*` package directly. Requires the schema's text node type to
  be named `"text"` (ProseMirror's own structural requirement).
- Selection — done (`packages/docs-editor-core/src/selection/`). Plain
  `{ anchor, head }` data plus `selectionFrom`/`selectionTo`/
  `isSelectionEmpty` helpers. Deliberately dependency-free so both the
  engine adapter and `EditorState` can depend on it without an inverted
  layering.
- Transactions & EditorState — done (`packages/docs-editor-core/src/state/`).
  `EditorState.create()`/`.tr`/`.apply()` and `Transaction.insertText()`/
  `.delete()`/`.addMark()`/`.removeMark()`/`.setSelection()`, wrapping the
  ProseMirror engine adapter internally. `EditorState` is immutable
  (`apply()` returns a new instance); `Transaction` is a mutable builder
  until applied, matching the Command Execution pipeline in
  ARCHITECTURE.md. Structural edits (wrap/lift/split/replaceWith) are
  deferred to Phase 3.
- Commands — done (`packages/docs-editor-core/src/commands/`). `Command`/
  `Dispatch` types; `deleteSelection`, `selectAll`, `toggleMark` (wrapping
  `prosemirror-commands` via the engine adapter, same encapsulation rule as
  the rest of the engine); `chainCommands`; `CommandRegistry` (ships empty —
  nothing auto-registered). Structural commands (split, lift, wrap) deferred
  to Phase 3 alongside `Transaction`'s structural methods.

  Fixing this uncovered a real bug in the engine adapter: docs-editor's
  `NodeSpec.marks` is declared per-node ("what marks can a node of this
  type carry"), but ProseMirror's own `NodeSpec.marks` is a per-container
  constraint ("what marks may this node's children carry"). The original
  1:1 translation silently produced a ProseMirror schema where no container
  ever permitted marks on its content — `addMark` ran without error but
  never actually applied anything. Fixed by having `compileEngineSchema()`
  compute each container's ProseMirror constraint as the union of the
  `marks` declared by every node type that can appear in its content. See
  `packages/docs-editor-core/README.md`'s Engine section.
- History engine — done. Undo/redo tracking wraps `prosemirror-history`
  (via the engine adapter, same encapsulation rule as the rest of the
  engine). Opt-in: `EditorState.create({ ..., history: true | { depth,
  newGroupDelay } })` — omitted by default, per CLAUDE.md's "Explicit Over
  Implicit" and matching ProseMirror's own history plugin being opt-in.
  `undo`/`redo` join the other commands in
  `packages/docs-editor-core/src/commands/`; both report `false` rather
  than throwing when there's nothing to undo/redo, including when a state
  was created without `history` enabled. Named versions, restore, and a
  visual timeline are Phase 9 (Version History), not this milestone.
- Clipboard abstraction — done (`packages/docs-editor-core/src/clipboard/`).
  `EditorState.copy(from?, to?)` returns a plain, JSON-safe `ClipboardContent`
  (nodes plus `openStart`/`openEnd`); `Transaction.paste(content, from?, to?)`
  is the inverse. Both default to the current selection. Wraps ProseMirror's
  `Node.slice()`/`Slice` via the engine adapter rather than reimplementing
  open-boundary rejoining by hand. No separate `cut` primitive — it's
  `copy()` then `tr.delete(...)`; writing to the system clipboard is a
  DOM/application concern, out of scope for this headless package.
- Serialization — done for native JSON (`packages/docs-editor-core/src/serialization/`).
  `DocumentSerializer` is bound to one schema; `deserialize()` rebuilds every
  node/mark through `Schema.node()`/`.text()`/`.mark()` rather than trusting
  the input, so corrupted or hand-edited JSON is rejected with the same
  actionable errors `Schema` already throws, instead of silently becoming a
  malformed document. HTML/Markdown import-export remain Phase 5 — the
  internal document model stays the sole canonical representation until then.
- Plugin architecture — deliberately deferred. Underspecified in the docs
  (no dedicated "Event System" section in ARCHITECTURE.md, and Phase 11 has
  its own "Plugin Architecture" phase with overlapping scope) and there's no
  concrete consumer yet — no plugins exist, no framework adapter exists.
  Designing the extension surface now would mean guessing at requirements
  rather than building against a real need, which CLAUDE.md's anti-over-
  engineering guidance and "Never Guess" both argue against.
- Event system — deliberately deferred, same reasoning as above.

Per ARCHITECTURE.md, ProseMirror is fully internal to `docs-editor-core`,
never exposed through its public API (an ESLint rule enforces this) — this
keeps a future engine swap a non-breaking internal change instead of a
major version bump for every consumer.

Exit Criteria:

- Documents can be created programmatically ✅
- Commands modify documents correctly ✅
- Undo/Redo functional ✅
- Core package has test coverage ✅ (84 tests across schema/engine/state/commands/serialization/clipboard)

All four exit criteria are met, but Phase 1 stays "In Progress" rather than
"Complete" — plugin architecture and the event system are still on the
deliverables list above and haven't been started (deliberately, see above).

Target Version:

v0.1.0

---

# Phase 2 — React Adapter

Status:

Complete

Objective:

Expose the editor through React.

Sequencing (chosen deliberately over building the Editor component first):
state layer first, defer the rendering fork. Milestone 2.1 below has no
dependency on how documents get rendered to `contentEditable`, so it could be
built and verified in isolation. Milestone 2.2 requires first resolving how
much of `prosemirror-view` (which owns the DOM/selection/input-event bridge)
gets exposed through the engine-handle abstraction versus reimplemented —
that's a real architectural fork, not a "Never Guess" call to make casually.

## Milestone 2.1 — State layer (done)

- `EditorProvider` — done (`packages/docs-editor-react/src/editor-provider.tsx`).
  Owns an `EditorState` via `useReducer` (reducer = `state.apply(transaction)`).
  Accepts `initialState` (read once, on mount) and an optional
  `onStateChange` callback.
- Context providers — done (`src/editor-context.ts`). Two separate contexts
  (state, dispatch), not one, specifically so dispatch-only consumers
  (toolbar buttons) don't re-render on every document change — dispatch's
  identity is stable across renders (comes straight from `useReducer`), so
  subscribing to only the dispatch context is a genuine render optimization,
  not premature splitting.
- Hooks — done (`useEditorState`, `useEditorDispatch`, `useEditor`). All
  throw a descriptive error when called outside an `EditorProvider`, per
  CLAUDE.md's Diagnostics guidance.
- React playground wiring — done. `apps/playground-react` uses the real
  `EditorProvider`/`useEditor()` with insertText/toggleMark/undo/redo
  buttons and a debug-only recursive tree preview (explicitly not a real
  rendering pipeline — see its `DocumentPreview.tsx`). Verified with 3
  Playwright e2e tests against a real Chromium build.
- `examples/basic-react` wiring — done, as a simpler read-only reference:
  builds a schema/document at module scope, wraps in `EditorProvider`, reads
  the document with `useEditorState()` only (no dispatch, no buttons).
- Package test coverage — done, 7 tests (`packages/docs-editor-react`).

See `packages/docs-editor-react/README.md` for the full API and the
rendering-component deferral rationale.

## Milestone 2.2 — Rendering (done)

- Engine-handle-exposure fork resolved: **core wraps the view.**
  `docs-editor-core` gained an opaque `EngineView`
  (`src/engine/prosemirror/view.ts`, wrapping `prosemirror-view`'s
  `EditorView`) and a public `EditorView` class (`src/view/`) that wraps it —
  no ProseMirror type crosses the package boundary, same rule as
  `EngineState`/`EngineTransaction`. `@sbh321/docs-editor-react`'s
  `<Editor />` is a thin `useEffect`/ref wrapper around this class; React
  never imports `prosemirror-*`.
- A second, unanticipated fork surfaced immediately after the first:
  `prosemirror-view` requires every node/mark to have DOM-rendering info
  (`toDOM`), but `Schema`/`NodeSpec` only modeled document *structure*. Asked
  and resolved the same way: **a renderer map, decoupled from `Schema`,
  supplied to the view — not baked into `NodeSpec`/`MarkSpec`.** For this
  milestone, `compileEngineSchema()` bakes in a generic *default*
  `toDOM`/mark `toDOM` (an element named after the node/mark, e.g.
  `<paragraph>`, `<bold>`) so every schema renders out of the box with zero
  configuration. Building the actual customization mechanism (letting a
  consumer register real per-node renderers, most likely via
  `prosemirror-view`'s per-view `nodeViews`/`markViews`, which are
  genuinely view-scoped and don't require recompiling the schema) is a
  **deferred follow-up**, not part of this milestone — see "Not yet built"
  below.
- Editor component — done (`packages/docs-editor-react/src/editor.tsx`).
  Mounts an `EditorView` on mount, syncs it via `updateState()` on every
  state change (not by reconstructing the view, which would drop DOM
  selection/IME state), destroys it on unmount. `editable` prop for
  read-only rendering.
- Two real, pre-existing/adjacent bugs found and fixed while building this:
  - `EditorState`/`Transaction`'s `@internal`-tagged `engine` field was
    never actually stripped from the published `dist/index.d.ts` — nothing
    had enabled TypeScript's `stripInternal`, so ProseMirror's own types
    (`prosemirror-state`'s `EditorState`/`Transaction`) were leaking into the
    public API despite the documented "fully internal" intent. Fixed via
    `stripInternal: true` in `docs-editor-core/tsup.config.ts`'s `dts`
    compiler options; verified by grepping the built `.d.ts` for
    `prosemirror` and confirming no import survives.
  - `@testing-library/react`'s automatic `afterEach` cleanup was silently
    not registering in `docs-editor-react`'s Vitest suite, since Vitest only
    exposes `afterEach` as a global when `test.globals: true` is set (which
    this project deliberately doesn't, per "Explicit Over Implicit") — so
    DOM from one test's `render()` was leaking into the next test in the
    same file. Fixed by explicitly registering `afterEach(cleanup)` in
    `src/vitest.setup.ts`.
- `apps/playground-react` and `examples/basic-react` both now render a real
  `<Editor />`. The playground's e2e suite gained a 4th test that types real
  keystrokes into the rendered `contentEditable` node and asserts the
  document updates — verified against a real Chromium build, not just unit
  tests.

Not yet built (explicitly deferred, not part of this milestone's scope):

- Cursor/selection visual sync beyond what `prosemirror-view` already
  provides natively (no docs-editor-specific work needed here yet — nothing
  has required it).

Customizable per-node/mark rendering — deliberately kept out of this
milestone's scope (it was never on Phase 2's original deliverables list) —
was built immediately after as its own follow-up; see Milestone 2.4 below.

## Milestone 2.3 — Next.js example (done)

- `examples/basic-next` — done. A minimal Next.js (App Router, Turbopack)
  reference, matching `examples/basic-react`'s minimalism. `EditorProvider`
  and `<Editor />` live in a `"use client"` component
  (`app/editor-demo.tsx`), since they touch the DOM and hold React state;
  the root layout and page stay Server Components — demonstrating the
  correct integration boundary, not just making it compile.
- Verified for real, not just built: `next build` statically prerenders the
  page with no hydration errors, and a live `next dev` session was driven
  with Playwright to confirm actual keystrokes typed into the rendered
  `contentEditable` node update the document — the same bar as Milestone
  2.2's playground verification, just in a Next.js runtime instead of Vite's.
- New shared tooling needed for this, added along the way:
  - `tooling/typescript-config/next-app.json` — extends `react-library.json`
    (same `lib`/`jsx` needs) with Next's required `plugins: [{ "name":
    "next" }]` and `noEmit`/non-composite settings, mirroring how
    `vite-app.json` already adapts `react-library.json` for a non-composite
    app entry point.
  - `tooling/eslint-config/base.js`'s shared `ignores` gained `**/.next/**`
    — without it, ESLint tried to lint Next's own generated build output
    (manifests, chunks, `.next/types/*.d.ts`) once it existed on disk, the
    same category of gap as the other build-output ignores already there
    (`dist/`, `.tsbuild/`, etc.), just never needed until now.
  - `turbo.json`'s `build` task gained `.next/**` (excluding
    `.next/cache/**`) in its `outputs`, matching turbo's standard
    recommendation for Next.js — without it, turbo couldn't cache this
    package's build output at all.
  - `pnpm-workspace.yaml`'s `allowBuilds` gained `sharp: true` (Next's
    optional native image-optimization dependency) — a supply-chain
    approval prompt from pnpm, not a decision specific to this package.

## Milestone 2.4 — Customizable rendering (done)

A follow-up beyond Phase 2's original deliverables list, done immediately
after Milestone 2.3 rather than left as an open-ended "later": every app
built during Milestones 2.1–2.3 rendered every node/mark as the same generic
placeholder tag, which meant nothing — not even toggling bold — was visually
distinguishable. This closes exactly that gap, using the design the fork in
Milestone 2.2 already resolved on: a renderer map, decoupled from `Schema`,
supplied to the view.

- `packages/docs-editor-core/src/dom-output-spec/` — new top-level module
  (same layering reason as `src/selection/`/`src/clipboard/`: a
  dependency-free type both `src/engine/` and `src/view/` need, so it can't
  live inside either without inverting the dependency direction).
  `DOMOutputSpec` mirrors ProseMirror's own DOM-output DSL (tag name,
  attributes, children/holes) without importing anything from
  `prosemirror-model`; `NodeRenderer<NodeName>`/`MarkRenderer<MarkName>` map
  type names to renderer functions.
- `src/engine/prosemirror/node-view.ts` — new internal file. Bridges a
  `(node) => DOMOutputSpec` function to a full `prosemirror-view` `NodeView`
  (and the `MarkView` counterpart) via `DOMSerializer.renderSpec`, so
  consumers write a small rendering function instead of learning PM's full
  node-view protocol (`getPos`, decorations, `ignoreMutation`, ...).
  `update()` re-renders and compares the new spec to the last one by value —
  since a spec's `0` hole doesn't encode content, this reuses the existing
  DOM (letting PM patch content into it) for ordinary edits, and only
  rebuilds when the node's own rendering actually changes (e.g. a link's
  `href` attribute).
- `EditorView`/`createEngineView` gained `nodeRenderers`/`markRenderers`
  options, wired to PM's `nodeViews`/`markViews` props — genuinely
  view-scoped, so a `Schema` used with zero renderers stays exactly as
  headless as before. Types without an entry keep using Milestone 2.2's
  generic default.
- `@sbh321/docs-editor-react`'s `<Editor />` gained the same two props,
  captured once at mount (like `dispatch`) rather than in the mount effect's
  dependency array — since these are almost always written as inline object
  literals, including them there would remount the view (dropping DOM
  selection/IME state) on every parent re-render.
- All three apps updated to use real semantic tags instead of the generic
  default (`paragraph` → `<p>`, and in the playground, `bold` → `<strong>`),
  and verified live in a Chromium browser via Playwright: toggling bold now
  produces an actual `<strong>` element with computed `font-weight: 700` —
  not just a structural change with no visual difference.

Exit Criteria:

- Editor renders successfully ✅ (real, typed-input-verified `contentEditable` rendering, in both Vite and Next.js runtimes)
- React integration stable ✅ (Milestone 2.1: state layer stable, tested, used by three apps)
- No React dependencies inside core package ✅

Target Version:

v0.2.0

---

# Phase 3 — Rich Editing

Status:

Complete

Objective:

Support professional document authoring.

Deliverables:

- Headings
- Paragraphs
- Lists
- Quotes
- Dividers
- Code blocks
- Tables
- Images
- Links
- Captions
- Keyboard shortcuts
- Copy/Paste
- Search
- Replace

## Milestone 3.1 — Headings (done)

The first new node type, chosen as Phase 3's starting slice specifically
because it needs no new content-model machinery beyond what already existed:
no list-nesting, no new leaf/atom node concept (needed later for dividers),
just an attrs-carrying block node that swaps with a paragraph in place.

- `heading` node type — added to the playground's schema (`group: "block"`,
  `content: "inline*"`, `attrs: { level: { default: 1 } }`). `doc`'s content
  expression changed from `"paragraph+"` to `"block+"`, resolving through
  the shared `"block"` group both `paragraph` and `heading` declare — this
  needed **no grammar change**. The content-expression matcher
  (`matchesTerm` in `src/schema/content-expression.ts`) already matches a
  term against a child's group as well as its literal type name, so "one of
  several sibling block types" was already expressible; Phase 1's
  documented alternation/grouping gap turned out not to block this.
- `Schema.blockType(type, attrs)` — new method (`src/schema/schema.ts`).
  Validates a node type + defaults its attrs without requiring content —
  `Schema.node()` always needs content, which doesn't fit "change this
  existing block's type in place." Mirrors `Schema.mark()`'s
  validate-and-default shape.
- `setBlockType(nodeType, attrs?)` — new command
  (`packages/docs-editor-core/src/commands/built-ins.ts`), wrapping
  `prosemirror-commands`' `setBlockType` (via a new
  `runEngineSetBlockType` in `src/engine/prosemirror/commands.ts`), the
  same encapsulation rule as `toggleMark`/`deleteSelection`/`selectAll`.
  Changes every textblock touched by the selection to the given type/attrs;
  reports `false` without dispatching when already that exact type and
  attrs (verified against `prosemirror-commands`' own source, not assumed).
- Wired into the playground: "Heading 1"/"Heading 2"/"Paragraph" buttons,
  and `nodeRenderers` mapping `heading` to `<h1>`–`<h6>` by its `level`
  attr. Verified live in Chromium via Playwright: clicking "Heading 1"
  really produces an `<h1>` containing the existing text, clicking
  "Heading 2" changes it in place to `<h2>` (not a new node), and
  "Paragraph" reverts it — not just a structural/JSON-level change.

Structural commands that actually restructure the tree (`wrapIn`/`lift`,
`split`) remained deferred at the end of this milestone, once concrete node
types existed to define them against; `setBlockType` only ever changes one
node's own type/attrs, not its position in the tree. `wrapIn`/`lift` were
built immediately after, as Milestone 3.2 below.

## Milestone 3.2 — Quotes (done)

The second Phase 3 slice, chosen specifically to introduce the next tier of
structural editing — wrapping/unwrapping a range in a container node —
without lists' extra complexity (item splitting on Enter, indent/outdent,
joining adjacent lists), which needs `split` and stays deferred.

- `blockquote` node type — `group: "block"`, `content: "block+"`. Its
  content expression recursively references the same `"block"` group it's
  itself a member of (a blockquote can contain paragraphs, headings, or
  another blockquote) — an ordinary, finite tree at the document level, so
  this needed no new schema machinery either.
- `runEngineWrapIn`/`runEngineLift` (`src/engine/prosemirror/commands.ts`)
  wrap `prosemirror-commands`' `wrapIn`/`lift` — `lift` is a plain
  pre-built `Command`, not a factory, since it lifts out of *whatever* the
  closest liftable ancestor is rather than targeting a specific node type
  (verified against `prosemirror-commands`' own source and doc comments,
  not assumed).
- `wrapIn(nodeType, attrs?)`/`lift` — new public commands
  (`src/commands/built-ins.ts`). `wrapIn` reuses `Schema.blockType()` for
  the same validate-and-default-attrs step `setBlockType` uses; `lift`
  takes no node type, matching the engine layer. Tested round-trip:
  `lift` after `wrapIn("blockquote")` restores the original structure
  exactly.
- Wired into the playground: "Quote"/"Un-quote" buttons, and a
  `nodeRenderers` entry mapping `blockquote` to `<blockquote>`. Verified
  live in Chromium via Playwright: "Quote" wraps the existing paragraph in
  a real `<blockquote>` (not a new detached node), "Un-quote" removes it,
  the paragraph and its text surviving both round-trips intact.

The one remaining structural command, `split`, stays deferred until lists
(which need it for "Enter creates a new list item") exist to define it
against.

## Milestone 3.3 — Links (done)

The lightest Phase 3 slice: a `link` mark with an `href` attr needed no new
engine or command work at all. `toggleMark(markType, attrs)` already
accepted attrs (used by `bold` since Milestone 2.2's fixtures, just never
exercised with a real attribute-carrying mark in an app), and
`markRenderers` already renders attribute-driven marks (proven by
`packages/docs-editor-core/src/view/editor-view.test.ts`'s own link-href
test). This milestone is real UI wiring, not new capability — worth
recording precisely because it demonstrates the existing primitives already
covered it.

- `link` mark (`attrs: { href: {} }`, no default — a link without a
  destination isn't meaningful) added to the playground's schema.
- Playground wiring: an `href` text input plus a "Toggle link" button
  calling `toggleMark("link", { href })`, and a `markRenderers` entry
  mapping `link` to `<a href="...">`. Verified live in Chromium via
  Playwright: selecting the paragraph's text, setting an href, and clicking
  "Toggle link" produces a real `<a>` with that exact `href` attribute
  wrapping the text; toggling again over the same selection removes it —
  the same add/remove-by-toggling behavior `bold` already has, since
  `prosemirror-commands`' `toggleMark` removes a mark type present anywhere
  in the selection rather than updating its attrs in place (an "edit an
  existing link's href without re-toggling" command, if ever needed, would
  be new work; simply adding/removing one was not).

## Milestone 3.4 — Keyboard shortcuts (done)

Pulled forward from later in Phase 3's deliverables list: real list editing
(next up) needs `Enter`/`Tab` bound to `splitListItem`/`sinkListItem`, which
needs key-binding infrastructure this package didn't have at all yet — no
command had ever been reachable by anything but a button click. Building it
now, generically, unblocks lists rather than one-off-wiring it later.

- New dependency: `prosemirror-keymap`. Its `keydownHandler(bindings)`
  returns a plain `(view, event) => boolean` function — usable directly as
  `EditorProps.handleKeyDown` — rather than `keymap()`'s `Plugin`-returning
  form, so this needed no PM Plugin system exposure (this package doesn't
  and still doesn't expose one). Reused rather than reimplemented for the
  same reason as every other `prosemirror-commands` wrapper: cross-platform
  modifier-key parsing (`"Mod-"` → Cmd on Mac, Ctrl elsewhere) is exactly
  the kind of well-tested edge case not worth re-solving.
- `EditorView`/`createEngineView` gained a `keymap` option
  (`src/view/editor-view.ts`, `src/engine/prosemirror/view.ts`) mapping
  key-combo strings to ordinary `Command`s. Bridging a `Command` (which
  operates on this package's own `EditorState`) into what `keydownHandler`
  needs (a function operating on the raw engine state) required a new
  `EditorState.fromEngine(schema, engine)` internal factory
  (`src/state/editor-state.ts`) — a keybinding can fire at any time, not
  just right after the view's last `updateState()` call, so it reconstructs
  a fresh `EditorState` wrapper around whatever engine state the view
  currently holds rather than relying on a possibly-stale captured one.
  Resulting transactions are dispatched through the exact same
  `dispatchTransaction` path as typed input.
- `@sbh321/docs-editor-react`'s `<Editor />` gained the matching `keymap`
  prop, read once at mount like `nodeRenderers`/`markRenderers`.
- Wired into the playground: `Mod-b` (bold), `Mod-z` (undo), `Shift-Mod-z`
  (redo). Verified live in Chromium via Playwright — with one real e2e
  finding along the way: simulating "select all" via a native `Ctrl-a`
  keydown immediately followed by another shortcut is flaky, since the
  browser's `selectionchange` event (which ProseMirror relies on to notice
  the new selection) doesn't reliably land before the next keydown fires.
  Not a docs-editor bug — real users don't chain two shortcuts with zero
  delay between them — but real enough to require using Playwright's
  `locator.selectText()` (sets the DOM selection directly) in the test
  instead of scripting the keystroke.

## Milestone 3.5 — Lists (done)

The biggest Phase 3 slice yet — new node types, new commands, and new
keybindings together — but Milestone 3.4 already having built key-binding
infrastructure meant this could be a complete, real feature (Enter creates a
new item, Tab/Shift-Tab indent/outdent) rather than another button-only
partial demo.

- `bullet_list`/`ordered_list`/`list_item` node types added to the
  playground's schema, following `prosemirror-schema-list`'s own recommended
  shape: `list_item`'s content is `"paragraph block*"` (a paragraph,
  optionally followed by a nested sub-list), so indenting an item creates a
  real nested list, not a flattening hack.
- New dependency: `prosemirror-schema-list`, for `wrapInList`,
  `splitListItem`, `liftListItem`, `sinkListItem` — list-specific structural
  commands `prosemirror-commands`' generic `wrapIn`/`lift` don't cover,
  since they need to know which node type represents a list item. Wrapped
  in a new `src/engine/prosemirror/list-commands.ts` /
  `src/commands/list-commands.ts` pair, mirroring the existing
  engine/public-command split exactly.
- `wrapInList` reuses `Schema.blockType()` like `wrapIn`/`setBlockType`
  (needs attrs, e.g. `ordered_list`'s `order`); `splitListItem`/
  `liftListItem`/`sinkListItem` only need the type name, validated the same
  way at the engine layer.
- Playground wiring: "Bullet list"/"Ordered list" buttons for `wrapInList`,
  plus `keymap` entries — `Enter: splitListItem("list_item")`,
  `Tab: sinkListItem("list_item")`, `Shift-Tab: liftListItem("list_item")` —
  and `nodeRenderers` mapping the three types to `<ul>`/`<ol>`/`<li>`.
  Verified live in Chromium via Playwright: pressing Enter at the end of a
  list item's text creates a genuinely new `<li>` (not a second paragraph
  inside the same one), Tab nests it under the previous item as a real
  sub-`<ul>`, and Shift-Tab lifts it back out.
- Two real, non-obvious e2e findings surfaced while verifying this
  (documented in `e2e/playground.spec.ts`, not assumed away):
  - The same selection-propagation race as Milestone 3.4's Ctrl+A finding,
    here between native `End`/`Enter` keydowns — fixed with short waits
    between real keystrokes (not needed between programmatic actions),
    verified by reproducing the race 3/8 times without them and 0/8 with.
  - A genuinely wrong test assertion, not a product bug: `"ul > li"` as a
    CSS selector matches a list item at *any* nesting depth, so once
    `sinkListItem` correctly created a nested list, the "only 1 top-level
    item" assertion still saw 2 elements and failed — even though the
    accessibility-tree snapshot in the failure report showed the sink had
    actually succeeded. Fixed by scoping to
    `"[contenteditable='true'] > ul > li"` (direct children only). Caught
    only because the failure was investigated down to the actual DOM
    structure instead of assumed to be another timing race.

Structural commands are now complete for everything currently in this
package's node catalog: `setBlockType`/`wrapIn`/`lift` (Milestones 3.1–3.2)
and `wrapInList`/`splitListItem`/`liftListItem`/`sinkListItem` (this one).

## Milestone 3.6 — Dividers (done)

The first *leaf* node type — no content at all, ever. Chosen next because it
exposed a genuine gap Milestones 3.1–3.5 hadn't needed: every command so far
only edited *existing* content (change a type, wrap/lift/split it); nothing
could insert a brand new node into the document.

- `divider` node type — `{ group: "block" }`, with **no `content` field at
  all** (not `content: ""`, just omitted). `Schema.node("divider")` already
  validated this correctly with zero new schema work: `validateContent()`
  already treats a node type with no content expression as one that must
  have zero children, and `compileEngineSchema()`'s default `toDOM` already
  omits the content "hole" for such types — both built during Milestones
  2.2/2.4 for reasons unrelated to leaf nodes specifically, but they turned
  out to already be exactly what a leaf node needs.
- `Transaction.insertNode(node, from?, to?)` — new method
  (`src/state/editor-state.ts`), the first genuinely new `Transaction`
  primitive since Milestone 1's initial set. Wraps `prosemirror-transform`'s
  `Transform.replaceWith(from, to, node)` (via a new
  `engineTransactionInsertNode` in `src/engine/prosemirror/state.ts`) — no
  new dependency, `prosemirror-transform` was already in use. Defaults
  `from`/`to` to the current selection, matching `paste()`'s existing
  pattern.
- Verified against real ProseMirror behavior rather than assumed: inserting
  a block-group node (like `divider`) at a *collapsed cursor inside a
  paragraph's inline content* still works — PM's own content-fitting logic
  splits the surrounding paragraph around the insertion point automatically,
  confirmed by a passing test rather than assumed from documentation.
- Wired into the playground: an "Insert divider" button and a
  `nodeRenderers` entry mapping `divider` to `<hr>` (no content hole, since
  it's a leaf). Verified live in Chromium: the resulting `<hr>` has
  `contenteditable="false"` automatically — ProseMirror renders leaf nodes
  as non-editable, single units without needing `NodeSpec.atom` (that flag
  is for a *different* case: non-leaf nodes that still want atom-like
  behavior, confirmed by reading `prosemirror-model`'s own doc comment
  rather than assumed from the name).

This same leaf-node + `insertNode` foundation is what images will need next.

While verifying this milestone's own e2e coverage, the full pipeline
surfaced a rare flake in Milestone 3.3's *link* test, unrelated to dividers:
it still simulated "select all" with a native `Ctrl+A` keydown, the same
race Milestone 3.4 had already found and fixed elsewhere (with
`locator.selectText()`) — just never backported to this older test since it
hadn't happened to flake yet. Fixed the same way; confirmed with 10 repeat
runs.

## Milestones 3.7–3.10 (batched)

Milestones 3.1–3.6 were each done as a full stop-verify-document cycle. The
remaining slices that could be built on the *existing* primitives (with no
new architectural fork) were then batched into one continuous pass — still
verified live in a real browser and covered by e2e tests before finalizing,
just without a separate documentation round-trip after each individual item.
Tables and visual search-match highlighting were **excluded** from the batch
because each needs a genuinely new capability (see Milestone 3.10's notes);
lumping them in would have meant either rushing an architectural decision or
silently dropping them.

### Milestone 3.7 — Code blocks (done)

The first node type that behaves differently *while editing its text*, not
just in how it's structured or rendered — pressing Enter inside it should
insert a literal newline, not split the block.

- `NodeSpec.code?: boolean` — new schema flag
  (`src/schema/types.ts`), propagated to the compiled ProseMirror node spec
  (`compileNodeSpec` in `src/engine/prosemirror/compile-schema.ts`). Verified
  against `prosemirror-model`'s `.d.ts`: `code` "causes some commands to
  behave differently" but does **not** by itself rebind Enter — that behavior
  comes from explicitly binding the two commands below.
- `newlineInCode`/`exitCode` — new public commands
  (`src/commands/built-ins.ts`), wrapping `prosemirror-commands`' own
  `newlineInCode`/`exitCode` (both plain `Command` values, not factories) via
  new `runEngineNewlineInCode`/`runEngineExitCode` engine functions — the same
  encapsulation rule as every other `prosemirror-commands` wrapper. Both
  report `false` outside a `code` node, so they compose in a `chainCommands`.
- Playground wiring: a "Code block" button (`setBlockType("code_block")`), a
  `nodeRenderers` entry rendering `code_block` → `<pre><code>`, and keymap
  bindings `Enter: chainCommands(newlineInCode, splitListItem("list_item"))`
  and `Mod-Enter: exitCode`. Verified live in Chromium: inside a code block,
  Enter inserts a real embedded newline (still one `<pre>`, not two blocks),
  and Ctrl/Cmd-Enter creates a fresh paragraph after it. The schema declares
  `code_block: { content: "text*", marks: "none", code: true }` — `marks:
  "none"` because formatting inside literal code is meaningless.

### Milestone 3.8 — Images, figures & captions (done)

Reuses Milestone 3.6's leaf-node + `Transaction.insertNode()` foundation with
zero new engine or command work — recorded precisely because it demonstrates
that foundation already covered a whole class of block content.

- `image` — a leaf node (`{ group: "block", attrs: { src, alt } }`, no
  `content`), inserted with `insertNode()` exactly like `divider`.
- `figure`/`caption` — a *near-leaf* composite: `figure: { content: "image
  caption?" }`, `caption: { content: "inline*" }`. This surfaced a real,
  previously-unexercised ProseMirror constraint: a node type in a **required**
  content position must be constructible from its attribute defaults alone.
  `image` initially had a required `src` attr, which made
  `figure`'s content invalid ("Only non-generatable nodes (image) in a
  required position") — fixed by defaulting `image`'s `src` to `""`. A real
  runtime error caught the gap, not an assumption; now documented in the core
  README's Schema section so the next composite node avoids it.
- The content-expression grammar needed no extension: `"image caption?"` is a
  plain two-term sequence, already within Phase 1's sequence + quantifier
  grammar (the alternation/grouping gap still doesn't block anything here).
- Playground wiring: "Insert image"/"Insert figure" buttons and
  `nodeRenderers` entries (`image` → `<img src alt>`, `figure` → `<figure>`,
  `caption` → `<figcaption>`). Verified live in Chromium: the `<img>` is a
  real non-editable leaf (`contenteditable="false"`), and "Insert figure"
  produces a correct nested `<figure><img><figcaption>` structure.

### Milestone 3.9 — Copy/Paste, verified (done)

No code change — a verification milestone. Native OS clipboard copy/paste
(Ctrl/Cmd-C/-X/-V) for same-document round-tripping already works through the
`EditorView` with zero new code: `prosemirror-view`'s own default clipboard
serialize/parse (derived from the compiled schema, using its same-schema fast
path) handles it. Confirmed live in Chromium via Playwright with clipboard
permissions granted — structure and marks survive a copy→paste round-trip.

- Phase 1's programmatic `EditorState.copy()`/`Transaction.paste()`
  (`src/clipboard/`) remains the headless, DOM-independent counterpart for
  copy/paste outside a live view; this milestone confirms the *interactive*
  path is already covered too. Documented in the core README's View section.
- Importing *arbitrary external* HTML pasted from another application
  faithfully still needs per-node `parseDOM` rules the schema doesn't model —
  that stays [Phase 5 — Import & Export](#phase-5--import--export), not a gap
  in this milestone.

### Milestone 3.10 — Search & Replace (done)

The batch's one genuinely new capability, plus a deliberate deferral.

- `findText(doc, query, options?)` — new pure function
  (`src/search/find-text.ts`, exported via a new `src/search/` module),
  returning every match as a `{ from, to }` range in the same position scheme
  `Transaction`/`EditorState` use. It walks the plain `DocumentNode` tree with
  no `EditorState`/engine involved — replicating ProseMirror's position
  counting in userland (non-root non-text nodes cost 1 for open + 1 for close;
  text contributes its length; the root `doc` costs nothing). Text runs with
  zero gap between them (i.e. same textblock) are merged before searching, so
  a match spans a mark boundary (`"Wor"` + bold `"ld"` → `"World"`) but never
  a block boundary (always a gap there). Case-insensitive by default;
  `{ caseSensitive: true }` opts in. 7 unit tests cover position math,
  multi-match, both case modes, the mark-boundary and block-boundary cases,
  empty query, and the replace round-trip.
- **Replace needs no new primitive** — it's `Transaction.insertText(replacement,
  match.from, match.to)` over a `findText()` result, mirroring how Links
  (3.3) needed no command beyond `toggleMark`. A dedicated test proves a
  match's range works directly as `insertText`'s `from`/`to`.
- Playground wiring: "Find"/"Replace with" inputs, a "Find next" button
  (advances to the next match from the cursor, wrapping around), and a
  "Replace" button (`insertText` over the current selection). Verified live
  in Chromium and covered by an e2e test proving Find-next cycles matches
  1→2→3→wrap and Replace acts on whichever is selected (8/8 repeat runs).

Deliberately deferred from this batch (genuine architectural forks, not silent
omissions — the same way Lists waited for Keyboard Shortcuts to exist):

- **Tables** — needed a new *selection type* and a plugin decision, so it was
  pulled out of the batch and given its own milestone. Subsequently
  implemented — see Milestone 3.11 below.
- **Visual search-match highlighting** — `findText()` deliberately returns
  positions only. Painting them (highlighting every match, not just moving the
  selection to the current one) needs a decoration/overlay rendering layer
  this package didn't have yet — a Phase 4 (UI) / rendering concern. **Resolved
  in Phase 4**: the decoration layer (`Decoration` + `EditorView.setDecorations`)
  and the adapter's `useSearchHighlight` now paint every match — see the Phase 4
  section.

## Milestone 3.11 — Tables (done)

The last Phase 3 deliverable, done as its own milestone (not part of the
3.7–3.10 batch) because — unlike everything before it — it genuinely could
*not* be built on the existing primitives. It required a new selection type
and a decision about ProseMirror's plugin system, both flagged as real
architectural forks and taken to the user before any code was written.

- New dependency: [`prosemirror-tables`](https://www.npmjs.com/package/prosemirror-tables).
  Reused rather than reimplemented for the same reason as every other PM
  wrapper — the table map, cell-selection geometry, and colspan/rowspan
  bookkeeping are exactly the kind of well-tested, edge-case-dense logic not
  worth re-solving. Its peer dependencies were all already satisfied by the
  installed PM packages.
- **New `NodeSpec.tableRole`** (`"table" | "row" | "cell" | "header_cell"`,
  plus a general `isolating` flag) — propagated by `compileNodeSpec`. This is
  how the engine's table support recognizes which nodes are tables/rows/cells.
  The content grammar's long-standing no-alternation gap did **not** need
  fixing: "a row holds cells or header cells" is expressed by giving both cell
  types a shared `group` and using it in the row's content (`content:
  "tablecell+"`), since the matcher already resolves group references — the
  same mechanism headings used in Milestone 3.1.
- **New `Selection` kind: `type: "cell"`.** A rectangular cell selection
  can't be represented as a linear `{ anchor, head }` text range, so
  `Selection` gained an optional `type` discriminant (`"text"` when omitted —
  fully backward-compatible). `selection-conversion.ts` builds a
  `prosemirror-tables` `CellSelection` for `"cell"` and reads one back as
  `"cell"`, addressed by the *cell* positions (`$anchorCell`/`$headCell`) —
  verified, not assumed: a CellSelection's own `.anchor`/`.head` point at
  inner text positions, so round-tripping through those would have been wrong.
- **ProseMirror's plugin system stays internal.** Rather than expose a plugin
  API (which the ESLint boundary rule forbids), interactive table editing is
  an opt-in state option — `EditorState.create({ tables: true })` — that
  installs `tableEditing()` internally, the exact same shape as `history:
  true`. A schema with no tables carries none of it.
- **Table commands** (`src/commands/table-commands.ts`, wrapping
  `prosemirror-tables` via `../engine`): `addColumnBefore`/`addColumnAfter`/
  `deleteColumn`, `addRowBefore`/`addRowAfter`/`deleteRow`, `mergeCells`/
  `splitCell`, `toggleHeaderRow`/`toggleHeaderColumn`, `deleteTable`. None
  take a node-type argument (the plugin locates the cell from the selection);
  each reports `false` outside a table. There's **no `insertTable`** — a table
  is built with `Schema.node(...)` and inserted with the existing
  `Transaction.insertNode()`, mirroring dividers/images (and how links reused
  `toggleMark`).
- Verified live in Chromium via Playwright, covering the parts unit tests
  can't: inserting a table, cursor-based add-row/add-column, **dragging across
  cells to produce a real `CellSelection`** (asserted via the plugin's
  `selectedCell` class), merging the selection into a `colspan=2` cell,
  toggling a header row, and deleting the table — reliable across 8 repeat
  runs. Unit tests cover the command results and the cell-selection
  round-trip.

Exit Criteria:

- Users can comfortably write long-form documents ✅ (headings, paragraphs, lists, quotes, dividers, code blocks, images/figures/captions, links, and tables)
- Core editing experience stable ✅ (keyboard shortcuts, copy/paste, undo/redo, search & replace)
- Major editing workflows tested ✅ (unit tests across schema/engine/state/commands plus 15 real-browser Playwright e2e tests)

Target Version:

v0.3.0

---

# Phase 4 — User Interface

Status:

Complete

Objective:

Provide a default headless UI implementation.

Deliverables:

- Toolbar
- Floating toolbar
- Context menu
- Slash menu
- Outline panel
- Table of contents
- Zoom controls
- Theme provider
- Icon package

Phase 4 delivered all nine in one pass, split cleanly across the two existing
packages plus one new one — never a styled component kit. Per ARCHITECTURE.md's
"Headless First" ("everything visible should be replaceable… nothing should
require a specific design system") every component is unstyled behavior only:
it accepts `className`/render props, reads optional theme class names, and works
with no styling at all. Two architectural decisions were taken to the user
before any code (matching Milestones 2.2/3.11): the UI components live in
`@sbh321/docs-editor-react` (not a separate UI package), and a default icon set
ships as a new `@sbh321/docs-editor-icons` package.

## The foundational gap: active-state queries (core)

The first thing Phase 4 needed didn't exist yet: a way to ask *"is this already
applied here?"*. A command dry run (`toggleMark("bold")(state)` → `boolean`)
answers *"can this apply?"* (a button's `disabled` state), but nothing answered
*"is bold currently on?"* (a button's *pressed* state). That's a pure query over
document + selection — framework-agnostic, so it belongs in **core**, and it's
the prerequisite every UI surface here shares. New `docs-editor-core` additions:

- `src/queries/` — `isMarkActive`/`activeMarks` (at a collapsed cursor these are
  the stored marks for the next character; over a range, only marks covering the
  *entire* selection, so a half-bold range reports bold inactive — matching what
  `toggleMark` would remove), `activeBlockType`/`isBlockActive`, and
  `getTextBefore(doc, pos)` (the text of the current block up to a position,
  for slash-trigger detection). Marks/block queries go through the engine
  adapter (they need `storedMarks` and the resolved-position parent, engine
  concepts); `getTextBefore` is pure over `DocumentNode` like `findText`.
- `src/outline/` — `getOutline(doc, options?)`, a pure function returning each
  heading's level/text/position range (defaults `"heading"`/`"level"`,
  overridable — the core models no fixed schema). Powers the outline panel and
  table of contents.
- `EditorView.coordsAtPos(pos)` — wraps `prosemirror-view`'s own `coordsAtPos`
  (no ProseMirror type crosses the boundary), for anchoring floating UI to a
  document position.
- `Transaction.scrollIntoView()` — flags a transaction so a live view scrolls
  the resulting selection into view (a no-op headless), used by outline
  navigation.
- **A decoration/overlay layer** — a new `src/decoration/` module (`Decoration`
  = `{ from, to, attributes }`, plain data like `Selection`/`DOMOutputSpec`) and
  `EditorView.setDecorations(...)`, which paints ranges (a class/style) without
  editing the document. Decorations are **view state**, deliberately kept out of
  the state/dispatch pipeline: routing them through `apply` would loop, since
  `state.doc` gets a fresh identity every apply. Positions are resolved against
  the current doc each render and clamped, so the model is "recompute and re-set
  on every change" — always correct, no position-mapping. This **resolves the
  Milestone 3.10 deferral**: `findText` gave the positions; the decoration layer
  paints them. It also generalizes to future comment/spellcheck overlays. The
  React adapter's `useSearchHighlight`/`<SearchHighlight>` (and the generic
  `useDecorations`) sit on top; the playground highlights all matches live, with
  a distinct class on the active one, covered by a new e2e test.

## `@sbh321/docs-editor-icons` (new package)

Optional default icons. A shared stroked, `currentColor`, `1em` `Icon` shell;
per-glyph tree-shakeable components (`BoldIcon`, `Heading1Icon`, …); and a
`defaultIcons` map keyed by editor *intent* (`"bold"`, `"heading1"`, …) so a
theme can swap artwork without callers changing lookups. Icons with no `title`
are `aria-hidden` (decorative); a `title` exposes them as labelled images. The
React components never import this package — icons reach them only through the
theme's `icons` map or an explicit prop, so the editor stays headless and the
icon bundle stays opt-in.

## `@sbh321/docs-editor-react` UI (headless components + hooks)

New dependency: [`@floating-ui/react`](https://floating-ui.com) for positioning
(named in PROJECT_SPEC), used only by the floating surfaces.

- **Hooks** — `useIsMarkActive`/`useIsBlockActive`/`useActiveMarks`/
  `useActiveBlockType` (wrap the core queries against current state),
  `useCommand` (bridges a `Command` to a control: `{ run, enabled }` — the seam
  between the command layer and any button), `useOutline`, and `useEditorView`
  (the live view, published upward by `<Editor />` via a new context so floating
  UI can read caret coordinates and refocus).
- **Toolbar** — `Toolbar` (`role="toolbar"`, roving-tabindex arrow-key
  navigation, one tab stop), `ToolbarButton` (auto-wires `disabled`/`aria-pressed`
  from a command + active state; resolves icons from `icon` or a theme
  `iconName`), `ToolbarGroup`, `ToolbarSeparator`.
- **FloatingToolbar** — follows a non-empty text selection, anchored to a
  virtual element built from `coordsAtPos`; hides when the selection collapses.
- **SlashMenu** — opens on a `/` trigger at a word boundary (detected via
  `getTextBefore`), filterable, keyboard-driven (capture-phase handler on the
  view so arrows/Enter don't move the caret). Choosing an item removes the typed
  `/query` and *then* runs the command as a second dispatch — two ordered edits
  keep document integrity, since a command's transaction is built from the
  post-deletion state.
- **ContextMenu** / **ContextMenuItem** — right-click menu at the pointer, focus
  trapped, dismiss on Escape/outside/selection, arrow-navigable.
- **OutlinePanel** / **TableOfContents** — jump-to navigation built on
  `useOutline` (flat vs. nested-ordered); clicking navigates + scrolls into view.
- **ZoomProvider** / **useZoom** / **ZoomControls** — zoom is *transient UI
  state*, which ARCHITECTURE.md's State Architecture assigns to the adapter, not
  the document model; the provider exposes an `editorStyle` (a `scale` transform)
  to spread onto `<Editor style>`.
- **ThemeProvider** / **useTheme** — a headless theme contract: `classNames`
  (per-slot), `icons` (by intent, accepting the icons package's `defaultIcons`),
  and `tokens` (exposed as CSS custom properties). No theme → components render
  unstyled and icon-free.

`<Editor />` gained a `style` prop (for the zoom transform) and now publishes
its `EditorView` into a context on mount.

## Verification

- Core: unit tests for the active-state queries, outline extraction, and
  text-before helper.
- React/icons: component/hook unit tests (Toolbar active + roving focus,
  ThemeProvider classes/icons/tokens, outline nesting + navigation, zoom
  clamping, icon rendering/a11y).
- Playground: rebuilt on the new components (preserving the Phase 3 e2e button
  labels and debug preview), with new Playwright e2e for toolbar active-state,
  the floating toolbar, the slash menu (open/filter/run + query removal), the
  right-click context menu, outline navigation, and zoom — the parts unit tests
  can't cover (real selection geometry, pointer events, live rendering).

Exit Criteria:

- Complete writing workflow supported ✅ (formatting, block styles, inserts,
  navigation, and zoom all reachable through the UI)
- UI remains fully replaceable ✅ (every component is unstyled behavior taking
  `className`/render props; icons and theme are opt-in)
- Styling remains optional ✅ (no component requires a theme or any CSS to
  function; `useTheme` degrades to an empty theme with no provider)

Target Version:

v0.4.0

---

# Phase 4.5 — Polish & Foundation Gaps

Status:

Complete

Objective:

Close the gaps between what `docs/ARCHITECTURE.md` and `docs/PROJECT_SPEC.md`
promise for the foundation (Phases 0–4) and what was actually built — the
"professional editing" polish that makes the editor feel finished — before
moving on to Import & Export (Phase 5). This is a *consolidation* phase: no new
architectural direction, just filling documented-but-missing capabilities.

Scope discipline: this phase fixes **foundational gaps** (things the editor
should already do), not aspirational features. Net-new features named in
PROJECT_SPEC's "Editing Capabilities" that are genuinely later work stay
deferred (see "Deliberately deferred" below).

## Gap analysis (docs vs. implementation)

Scanning ARCHITECTURE.md and PROJECT_SPEC.md against the Phase 0–4 code
surfaced these as real gaps:

- **Essential editing keymap is missing.** Only a subset of `prosemirror-
  commands` is wrapped (`toggleMark`, `setBlockType`, `wrapIn`, `lift`,
  `deleteSelection`, `selectAll`, `newlineInCode`, `exitCode`). The commands
  that make a text editor behave like one — `splitBlock` (Enter), `joinBackward`/
  `joinForward` (Backspace/Delete at a boundary), `selectNodeBackward`/
  `selectNodeForward`, `liftEmptyBlock`, `createParagraphNear`,
  `selectParentNode` — don't exist, and there's no ready-made base keymap. Today
  pressing **Enter in a paragraph doesn't split it** and Backspace doesn't join
  blocks. Contradicts ARCHITECTURE.md's "Keyboard-first editing" and
  PROJECT_SPEC's "native, familiar" design goals.
- **Selection is incomplete.** ARCHITECTURE.md's Selection System lists "Block
  selection"; `Selection` only models `"text"` and `"cell"`. A `NodeSelection`
  (clicking an atomic leaf like an image or divider) isn't representable, so
  selecting/deleting such a node as a unit isn't supported.
- **`MarkSpec` is under-modeled.** It exposes only `attrs` — no `inclusive`,
  `excludes`, or `code`. So a link is "inclusive" (typing at its end extends
  it), and there's no real inline-code mark. A professional editor needs these.
- **No "Remove Formatting".** PROJECT_SPEC lists it; there's no
  `removeFormatting` command.
- **The standard text-formatting marks aren't demonstrated.** PROJECT_SPEC's
  Text Formatting lists bold, italic, underline, strike, highlight, inline
  code; only bold and link exist. Icons for the rest already ship in
  `@sbh321/docs-editor-icons`, but nothing wires them up.
- **Storybook is unused.** Phase 0 set up Storybook "for component
  documentation"; only an `Introduction.mdx` exists — no stories for the Phase 4
  headless UI.

## Milestone 4.5.1 — Essential editing commands + base keymap (core)

The highest-value gap. Wrap the remaining first-party `prosemirror-commands`
(same encapsulation rule as every other engine wrapper) and ship a ready-made
keymap so the editor works out of the box.

- New commands in `src/commands/`: `splitBlock`, `joinBackward`, `joinForward`,
  `joinUp`, `joinDown`, `liftEmptyBlock`, `createParagraphNear`,
  `selectNodeBackward`, `selectNodeForward`, `selectParentNode` — each wrapping
  its `prosemirror-commands` counterpart via a new
  `src/engine/prosemirror/base-commands.ts`.
- **`baseKeymap`** — a `Record<string, Command>` adapting `prosemirror-commands`'
  own `baseKeymap` (its exact, cross-platform, well-tested bindings for Enter,
  Backspace, Delete, Mod-a, etc.), exposed as docs-editor `Command`s so a
  consumer gets a working editor from one line: `keymap={{ ...baseKeymap, ...my
  bindings }}`.
- Wire into the playground: replace the ad-hoc Enter binding with `baseKeymap`
  plus the list/code overrides. New e2e proving Enter splits a paragraph,
  Backspace joins, and Enter in an empty list item exits the list.

## Milestone 4.5.2 — Node / block selection (core)

- `Selection.type` gains `"node"`; `selection-conversion.ts` builds and reads a
  `NodeSelection` for it (addressed by the position *before* the node).
- A `Transaction.selectNode(pos)` helper (and the base keymap's
  `selectNodeBackward`/`-Forward` from 4.5.1) let a leaf node be selected and
  deleted as a unit.
- Verified: clicking an image/divider round-trips as `type: "node"`, and
  Backspace deletes the selected node.

## Milestone 4.5.3 — Mark expressiveness, formatting marks & remove-formatting (core + example)

- Extend `MarkSpec` with `inclusive?` and `excludes?`, propagated by
  `compileMarkSpec`. Link becomes non-inclusive (`inclusive: false`); an inline
  `code` mark uses `excludes: "_"` so it can't combine with the others.
- `removeFormatting` command — clears every mark across the selection (PM's
  `tr.removeMark(from, to, null)`), reported `false` when there's nothing to
  clear.
- Demonstrate the full inline set in the playground schema + toolbar: `italic`,
  `underline`, `strikethrough`, inline `code`, `highlight` (reusing the existing
  icons), each with active-state buttons and shortcuts (`Mod-i`, `Mod-u`, …).

## Milestone 4.5.4 — Storybook component documentation (react)

- Stories for the Phase 4 headless UI (`Toolbar`/`ToolbarButton`,
  `FloatingToolbar`, `SlashMenu`, `ContextMenu`, `OutlinePanel`/
  `TableOfContents`, `ZoomControls`, `ThemeProvider`) plus the icon set, so
  `pnpm storybook` documents the components with live, themeable examples —
  delivering the Phase 0 "Storybook for component documentation" promise.

## Milestone 4.5.5 — Accessibility & diagnostics pass (cross-cutting)

- Audit ARIA/roles/labels across all Phase 4 components; add any missing
  accessible names and `focus-visible` affordances.
- Respect `prefers-reduced-motion` in any transitions the examples add;
  document that the headless components ship no motion of their own.
- Confirm errors stay actionable (schema/engine/command diagnostics) and add
  regression tests for any gap found.

## Deliberately deferred (aspirational features, not foundational gaps)

These are named in PROJECT_SPEC's "Editing Capabilities" but are net-new
features rather than gaps in the 0–4 foundation, and belong to a later phase or
"Future Exploration":

- Font color / background color, and paragraph formatting (alignment, line
  height, indentation, spacing, direction) — node/mark *attributes* + commands;
  a feature milestone of their own.
- Task lists / checklists, page breaks, super/subscript, syntax highlighting —
  additional node/mark types, added when there's a concrete need.
- HTML / Markdown / PDF import-export and paste sanitization — **Phase 5**.
- Multi-selection — noted "Future" in the Selection System.
- Plugin/event system — **Phase 11**. Storage adapters — **Phase 9**.

Milestone 4.5.5 note: an accessibility audit found the Phase 4 components
already sound — `role`/`aria-*` correct, roving focus, focus trapping, keyboard
dismissal — so no component changes were needed. The components ship no motion
of their own (so nothing ignores `prefers-reduced-motion`), and the playground
adds `:focus-visible` outlines and a reduced-motion guard as the *app's*
styling. One documented simplification: `SlashMenu` keeps focus in the editor
while filtering (a lightweight `role="listbox"` of `option` buttons) rather than
implementing the full ARIA combobox pattern — a reasonable headless baseline.

Exit Criteria:

- The editor behaves like a text editor out of the box (Enter splits, Backspace
  joins, Delete works) with a single `baseKeymap` ✅
- Atomic nodes can be selected and deleted as a unit ✅ (`Selection` type
  `"node"`, `Transaction.selectNode`, click-to-select round-trip)
- Links don't over-extend; a full inline-formatting set (italic, underline,
  strikethrough, inline code, highlight) plus `removeFormatting` works, with
  active-state UI ✅
- Phase 4 UI components are documented in Storybook ✅ (Toolbar, Floating UI,
  Navigation, Zoom, Icons — `build-storybook` passes)
- No accessibility regressions; all packages build, lint, typecheck, and test
  clean ✅

Target Version:

v0.4.1

---

# Phase 5 — Import & Export

Status:

Complete — all six milestones (5.1–5.6) shipped and their exit criteria met.
Serialization contracts + registry + JSON (5.1), HTML export (5.2), sanitized
HTML import + `HtmlParseSpec` (5.3), the `@sbh321/docs-editor-markdown` package
(5.4), print-friendly rendering + browser print-to-PDF via `PrintExporter`
(5.5), and per-format round-trip/interop tests plus the playground import/export
panel wired end-to-end (5.6).

Objective:

Make documents portable — importable from and exportable to the formats the
broader ecosystem uses — while keeping the internal document model the single
source of truth. Per ARCHITECTURE.md's Serialization Architecture: the internal
model stays authoritative, **importers translate external formats *into* the
model, exporters translate the model *out*, and no external format ever becomes
the canonical representation.**

This section expands the roadmap's original five-line Phase 5 with everything
the architecture and spec actually require of import/export — the serialization
architecture, the import/export pipelines, the interoperability targets,
security, scalability, and plugin-extensibility — none of which the short
version captured.

## What already exists (the baseline)

- **JSON is done** (Phase 1). `DocumentSerializer.serialize()`/`deserialize()`
  round-trips the native model; `deserialize()` rebuilds every node/mark
  *through the schema* rather than trusting input, so corrupt/untrusted JSON is
  rejected with actionable errors. Phase 5 keeps this and re-frames it under a
  shared contract (see 5.1).
- **Same-document clipboard** copy/paste works via the view (Phase 3.9). But
  importing *arbitrary external* HTML (pasted from Google Docs, Word, a web
  page) faithfully was explicitly **deferred to Phase 5** — it needs per-node
  `parseDOM` rules the schema doesn't model yet (see 5.3).
- **Rendering is one-directional.** The view renders nodes/marks to DOM via
  `DOMOutputSpec` renderer maps (`nodeRenderers`/`markRenderers`), but there is
  **no inverse DOM→node parse layer**, and no HTML/Markdown/PDF serializer.

## Requirements pulled from ARCHITECTURE.md & PROJECT_SPEC.md

These are the constraints Phase 5 must satisfy (not just "add formats"):

- **Formats.** Import: JSON, HTML, Markdown (DOCX "later"). Export: JSON, HTML,
  Markdown, PDF (DOCX future). Future formats: ODT, RTF, EPUB — out of scope.
- **Interoperability targets:** Google Docs, Microsoft Word, Markdown editors,
  static-site generators, HTML editors. *Maximize* round-trip fidelity for
  commonly-supported features; perfect fidelity is **not** required where the
  underlying models differ (spec is explicit on this). Documents exported must
  be openable/editable in Google Docs and Word with minimal loss, and documents
  from those apps importable with minimal loss.
- **Security (first-class):** never execute arbitrary HTML; sanitize imported /
  pasted content; validate imported documents; prevent unsafe serialization.
- **Scalability:** large-document import/export should avoid blocking, and the
  design should *anticipate* streaming, chunked processing, progress reporting,
  cancellation, and future background execution — even if v0.5.0 ships
  synchronous implementations.
- **Plugin-extensibility:** the Plugin System lists Serializers, Importers, and
  Exporters as plugin contributions. Phase 5's contracts must be shaped so a
  Phase 11 plugin (or a first-party format package) can register a new format
  without changing core.

## Architectural decisions (locked)

**Where do format serializers live?** HTML and Markdown serialization both need
the *compiled ProseMirror schema* (`prosemirror-model`'s `DOMSerializer`/
`DOMParser`; `prosemirror-markdown`'s serializer/parser), which the ESLint
engine-boundary rule keeps **inside `docs-editor-core`'s `src/engine/`**. A
separate package therefore *cannot* implement them by importing ProseMirror
directly without breaching the boundary. Decisions:

- **HTML + the serialization contracts + JSON live in `docs-editor-core`**,
  engine-encapsulated (HTML needs only `prosemirror-model`, already a core dep —
  **zero new deps**).
- **Markdown lives in a new `@sbh321/docs-editor-markdown` package**, built on a
  **core serialization primitive**: Milestone 5.1 exposes a small, headless
  hook (a way to render the doc to DOM and to parse DOM/tokens back through the
  compiled schema) so the Markdown package can implement `prosemirror-markdown`/
  `markdown-it` *without* importing ProseMirror itself — keeping core lean, the
  engine boundary intact, and matching the PROJECT_SPEC ecosystem. Designing
  that primitive cleanly is part of 5.1's scope.

**PDF: print-friendly rendering + browser print-to-PDF.** PDF for v0.5.0 is a
print stylesheet + a "print view" built on the HTML exporter, using the
browser's `window.print()` — zero heavy deps, framework-agnostic, works
everywhere; "professional report" quality comes from the browser's print
engine. A programmatic `@sbh321/docs-editor-export-pdf` package (e.g. pdf-lib,
for headless/server-side PDF) is an explicit **follow-up**, not v0.5.0.

## Milestone 5.1 — Serialization contracts & JSON (core, no new deps)

The seam every format plugs into.

- Define `DocumentExporter` / `DocumentImporter` contracts (bound to a schema):
  an exporter turns a `DocumentNode` into a string (or, later, a `Blob`/stream);
  an importer turns external input into a validated `DocumentNode`. Return types
  shaped so a future async/streaming variant is additive, not breaking.
- A `SerializationRegistry` (mirroring `CommandRegistry`) mapping a format id to
  its importer/exporter — the surface a plugin registers into (anticipates
  Phase 11).
- Re-express the existing JSON serializer as the reference implementation of the
  contract (keep `DocumentSerializer`'s validate-through-schema behavior).

## Milestone 5.2 — HTML export (core; reuses `DOMOutputSpec`)

- `HtmlExporter` serializes a `DocumentNode` to an HTML string using per-node/
  mark `DOMOutputSpec` renderers (the *same* shape the view uses, so exported
  tags match what's rendered), via `prosemirror-model`'s `DOMSerializer`
  (engine-encapsulated). Generalize the renderer map so it's usable without a
  live view, shared between the view and the exporter.
- "Prevent unsafe serialization": rely on the serializer's attribute escaping;
  add tests for injection-shaped attribute values.
- Deterministic output suitable for static-site generators and HTML editors.

## Milestone 5.3 — HTML import + sanitization (core; new parse-spec + security)

The largest new primitive, and the security-critical one.

- **New `parseDOM` / parse-rule concept** — per-node/mark rules mapping DOM
  (tag + attributes) → node/mark type + attrs. The inverse of `DOMOutputSpec`,
  decoupled from the schema the same way renderers are (a supplied map, not
  baked into `NodeSpec`).
- `HtmlImporter` parses an HTML string → validated `DocumentNode` via
  `prosemirror-model`'s `DOMParser` (engine-encapsulated), rebuilt through the
  schema (same validate-through-schema guarantee as JSON deserialize).
- **Sanitization (mandatory):** an allowlist pass that strips `<script>`,
  event-handler attributes (`on*`), `javascript:`/`data:` URLs, and any
  tag/attribute not modeled — so **arbitrary HTML is never executed**. This is
  the concrete implementation of the Security section.
- **Bonus:** the same parse rules upgrade *interactive paste* of external HTML
  (the Phase 3.9 deferral) — pasting from Google Docs/Word/a web page maps into
  the schema instead of falling back to plain text.

## Milestone 5.4 — Markdown import/export (`@sbh321/docs-editor-markdown`, new package)

- `MarkdownExporter` / `MarkdownImporter` over `prosemirror-markdown`
  (`MarkdownSerializer`/`MarkdownParser`) + `markdown-it`, with schema-specific
  serialize functions and token parse specs — in the new
  `@sbh321/docs-editor-markdown` package, built on the core serialization
  primitive from 5.1 (so it never imports ProseMirror directly).
- **Fidelity contract:** Markdown is intentionally lossy — features it can't
  express (colors, complex tables, some structure) degrade predictably; document
  exactly what survives a round trip. Targets Markdown editors and static-site
  generators.
- Evaluate `prosemirror-markdown` + `markdown-it` against CLAUDE.md's dependency
  policy (maintenance, TS support, bundle size, tree-shaking) before adding.

## Milestone 5.5 — PDF export & print-friendly rendering (print-to-PDF)

- **Print-friendly rendering:** a print stylesheet and a "print view" produced
  by the HTML exporter (clean, pagination-friendly markup; hides editor chrome),
  so a document prints — and browser-print-to-PDFs — as a professional report.
- **PDF export** via the browser's `window.print()` on that print view; a
  programmatic `@sbh321/docs-editor-export-pdf` package is a deferred follow-up.
- Wire a "Print / Export PDF" action into the playground.

## Milestone 5.6 — Interoperability, round-trip tests & playground wiring

- Round-trip test suites per format: **JSON exact**; **HTML** faithful within
  the schema's modeled features; **Markdown** faithful within Markdown's
  expressiveness (with the documented lossy cases asserted, not hidden).
- Informal Google Docs / Word interop check: HTML copied out pastes in cleanly,
  and HTML from those apps imports with minimal loss.
- Playground: import/export controls for JSON, HTML, and Markdown, plus the
  print/PDF action — verified end-to-end (unit + Playwright e2e).

## Deliberately deferred

- **DOCX** import/export — was deferred out of v0.5.0; now delivered as an
  additive follow-up in **Phase 5.7** below (`@sbh321/docs-editor-docx`), which
  is exactly the "architecture should support it later" the deferral anticipated
  — no core rewrite, just a companion package plus a backward-compatible
  generalization of the serialization contracts.
- **ODT / RTF / EPUB** — future formats, out of scope.
- **Streaming / chunked / background execution** for very large documents — the
  contracts (5.1) are shaped to allow it, but v0.5.0 ships synchronous
  implementations; progress/cancellation land when a real large-document need
  exists.
- **Programmatic PDF package** (`@sbh321/docs-editor-export-pdf`) — deferred;
  v0.5.0 ships the print-to-PDF baseline instead.

## Package ecosystem impact

- HTML + the serialization contracts + JSON + the Markdown serialization
  primitive: **`docs-editor-core`**.
- Markdown: **`@sbh321/docs-editor-markdown`** (new package), matching the
  PROJECT_SPEC planned ecosystem.
- PDF: print-based (core/adapter) for v0.5.0; `@sbh321/docs-editor-export-pdf`
  later.

## Dependencies to evaluate (CLAUDE.md dependency policy)

- `prosemirror-markdown` + `markdown-it` (+ `@types/markdown-it`) — Markdown.
- A PDF library (e.g. `pdf-lib`) — only if the programmatic PDF path is chosen.
- No new dep for HTML (reuses `prosemirror-model`) or JSON.

Exit Criteria:

- Documents round-trip **without data loss** where the format supports it: JSON
  exact; HTML/Markdown faithful within their modeled/expressible features (lossy
  cases documented and tested, not silent)
- HTML import **never executes arbitrary content** — sanitized against an
  allowlist, validated through the schema
- Importers translate *into* the model and exporters *out*; the internal model
  stays the single source of truth (no external format becomes canonical)
- A document can be exported and re-opened in Google Docs / Word with minimal
  formatting loss, and content from those apps imported with minimal loss
- PDF output suitable for professional reports (via print-friendly rendering)
- Serialization contracts are plugin-ready (a new format can be registered
  without changing core)
- All packages build, lint, typecheck, and test clean

Target Version:

v0.5.0

---

# Phase 5.7 — DOCX Import & Export

Status:

Complete — `@sbh321/docs-editor-docx` ships `DocxExporter` (→ `.docx` bytes via
`docx`) and `DocxImporter` (`.docx` → HTML via `mammoth` → sanitized
`HtmlImporter`). The serialization contracts were generalized (payload-generic,
async-tolerant) with zero change to existing exporters/importers or the
registry. Wired into the playground (download on export, file-picker on import,
lazy-loaded) with an end-to-end binary round-trip test.

Additive follow-up to Phase 5, re-opening the deferred DOCX item now that the
serialization architecture (contracts + registry + the HTML import pipeline) is
in place to support it cleanly.

Objective:

Import and export Microsoft Word `.docx` documents while keeping the internal
model authoritative — DOCX is just another pair of importer/exporter over the
public `DocumentNode` + `Schema`, exactly like Markdown. No format becomes
canonical; the `.docx` is translated *in* and *out*.

## Why it needs more than a string exporter

Unlike JSON/HTML/Markdown, `.docx` is **binary** (a ZIP of Office Open XML
parts) and the mapping libraries are **asynchronous**. Phase 5's contracts were
string- and sync-typed. Rather than bolt on a parallel contract, the two
interfaces are generalized once, backward-compatibly:

- `DocumentExporter<NodeName, Output = string>` — `serialize(doc): Output`
- `DocumentImporter<NodeName, Input = string, Result = DocumentNode<NodeName>>` — `parse(input): Result`

Defaults keep every existing exporter/importer and the synchronous
`SerializationRegistry` unchanged (the registry is typed to the `string`
default, so it accepts only string formats — a binary DOCX exporter isn't
assignable and is used directly). DOCX is then a first-class member of the same
contract family: `DocumentExporter<NodeName, Promise<Uint8Array>>` and
`DocumentImporter<NodeName, ArrayBuffer, Promise<DocumentNode<NodeName>>>`.

## Package & dependencies

New companion package **`@sbh321/docs-editor-docx`** (like `-markdown`, works
only over the public model — never the engine). Dependencies, weighed against
CLAUDE.md's dependency policy:

- **`docx`** (dolanmiu) — mature, TypeScript-native, MIT, browser-capable;
  builds `.docx` from a JS object model. Used for **export**.
- **`mammoth`** — mature, widely adopted, MIT; converts `.docx` → HTML. Used for
  **import**, then fed through core's already-sanitized `HtmlImporter`, so DOCX
  import inherits the schema validation and security guarantees rather than
  introducing a second parsing/sanitization surface.

## Milestones

- **5.7.0 — Contracts.** Generalize `DocumentExporter`/`DocumentImporter`
  (payload-generic, async-tolerant). Backward compatible; registry unchanged.
- **5.7.1 — Package scaffold.** `@sbh321/docs-editor-docx` + build/test config.
- **5.7.2 — Export.** `DocxExporter` + a `DocxSpec` type-name map (like
  `MarkdownSpec`): headings, paragraphs, bold/italic/underline/strike/code,
  links, bullet/ordered lists, blockquote, code blocks, dividers, tables,
  images. Returns `Promise<Uint8Array>`.
- **5.7.3 — Import.** `DocxImporter`: `mammoth` (`.docx` bytes → HTML) →
  `HtmlImporter` (sanitized, schema-validated). Binary input, async result.
- **5.7.4 — Tests.** Export→import round-trip within DOCX-expressible features;
  structure/mark mapping; security (no script execution through the HTML path).
- **5.7.5 — Playground + docs.** DOCX in the import/export panel (download on
  export, file-picker on import); e2e; READMEs, ARCHITECTURE, changeset.

## Deliberately deferred (unchanged)

- **ODT / RTF / EPUB**, programmatic PDF, and streaming/chunked execution —
  still out of scope; the generalized contracts leave room for all of them.

Exit Criteria:

- A document exports to `.docx` and re-opens in Microsoft Word / Google Docs
  with minimal formatting loss, and `.docx` from those apps imports with minimal
  loss (faithful within DOCX-expressible, schema-modeled features)
- DOCX import **never executes arbitrary content** — it rides the existing
  sanitized HTML import path and is rebuilt through the schema
- The internal model stays the single source of truth (DOCX is translated in/out)
- Core serialization contracts remain backward compatible; no change to existing
  string exporters/importers or the registry's public behavior
- New package and all existing packages build, lint, typecheck, and test clean

Target Version:

v0.6.0

---

# Phase 5.8 — Document Fonts & Page Layout

Status:

Complete — document font families, a full page-layout system, and live
pagination, delivered as editor-experience enhancements on top of the Phase 4
headless UI.

Objective:

Make the editor feel like a professional document editor: choose fonts, and lay
documents out on real pages (sizes, orientation, margins, headers/footers, page
numbers) with content flowing across multiple sheets as it grows.

Deliverables:

- **Fonts & colors.** A reusable core `setMark(markType, attrs)` command (set an
  attribute-carrying mark to a value, replacing any existing one; stored-mark
  handling at a collapsed cursor). The playground adds a `font_family` mark and
  a font picker with common web-safe families (Arial default), plus a
  `text_color` mark and a color-carrying `highlight`, with text/highlight color
  pickers. Colors carry through HTML, print, and DOCX exports (run `color` /
  `shading`); Markdown drops them (text preserved).
- **Page feel.** The editor content area fills the page and drops the default
  contenteditable focus outline with a page-appropriate `caret-color`, so it
  reads as a page rather than an input field, and a click anywhere on the page
  places the caret.
- **Page layout (core).** A framework-agnostic `page-layout` module —
  `PAGE_SIZES` (A4/A3/A5/Letter/Legal/Tabloid/Executive), orientation, margin
  presets, `PageLayout`, `resolvePageDimensions()`. Presentation, kept out of
  the document model. `PrintExporter` gained a `pageLayout` option (`@page`
  size/margins + running header/footer).
- **Page layout & pagination (react).** `PageLayoutProvider`/`usePageLayout`,
  `PageSetupControls`, and `PageSurface` (the page view). **Live pagination**
  (`usePagination`): content flows onto multiple sheets with gaps, recomputed on
  every content/layout/size change.
- **Decoration engine extensions (core), enabling pagination safely.** Node
  decorations (`Decoration.type: "node"`) to attribute a block's own element;
  source-composed decorations (`setDecorations(decorations, source)`) so pagination
  and search coexist; `EditorView.posAtDOM()` to map a measured element back to
  a document position. The editor stays a single contenteditable — page breaks
  are visual decoration spacing, never document edits.

Design notes:

- Pagination measures in **scale-independent natural coordinates** (each block's
  position with the currently-applied break spacing subtracted), so it converges
  in one extra pass instead of oscillating, and stays correct under zoom.
- Known limitation: a block taller than a page overflows rather than splitting.
- For print, page numbers rely on the on-screen paginated view / the browser's
  print options; CSS page counters aren't reliably supported across browsers.

Exit Criteria:

- A font can be applied to a selection and carried into newly typed text
- Documents render on real page sizes/orientation with margins, headers,
  footers, and page numbers
- Content reflows across multiple sheets live as it grows, without corrupting
  editing, selection, undo, or search highlighting
- All packages build, lint, typecheck, and test clean (unit + Playwright e2e)

Target Version:

v0.6.0

---

# Phase 6 — Performance Optimization

Status:

**Complete** — all eight milestones (6.1–6.8) shipped. Full methodology,
baselines, findings and budgets: [docs/PERFORMANCE.md](./PERFORMANCE.md).

Headline results, all measured rather than assumed:

| Metric | Before | After |
| --- | ---: | ---: |
| Keystroke `apply`, 5000 paragraphs | 4.588 ms | **0.021 ms** (~218×) |
| Selection change, any document size | 4.764 ms | **0.0004 ms** (flat) |
| Headless bundle | 73.5 KB gz | **36.0 KB gz** (−51%) |
| Pagination cost per keystroke | 2.80 ms | **0.75 ms** (−73%) |
| Heap over 120 edit/undo cycles | — | +0.6 MB, bounded |

What the phase actually taught, beyond the numbers:

1. **Measure first, and in the right environment.** Two conclusions drawn from
   jsdom were wrong in a browser: HTML import looked 26× more expensive than
   JSON import when it is in fact the *faster* of the two (6.7), and the
   biggest per-keystroke cost turned out to be browser layout, not our code
   (6.3).
2. **The bottleneck is rarely where the plan assumed.** 6.4 was scoped to make
   pagination measurement incremental; measuring showed a full pass costs
   0.61 ms and the problem was *how often it ran*. The incremental measurement
   was never built.
3. **Optimizations must be re-measured, not assumed.** An `offsetTop` swap
   "for speed" was marginally slower, and a convergence fast-path broke
   settling entirely — both reverted or re-justified, and recorded so they are
   not retried.
4. **Gate only on deterministic signals.** Size budgets fail CI; timings do
   not, because they reach 25% RME (6.8).

Objective:

Prepare Docs Editor for production-scale documents so it stays smooth from a
one-line note to a 100+ page report, and lock in that behavior with measurement
and regression guardrails. This phase does not add features — it makes the
existing ones fast, predictable, and cheap, and preserves that over time.

This section expands the roadmap's original seven-line Phase 6 with everything
the documentation actually asks of performance and scalability — pulled from
PROJECT_SPEC "Performance First"/"Performance Goals", ARCHITECTURE "Performance
Strategy"/"Performance Budget"/"Scalability Strategy" (Large Documents, Memory
Management, Rendering Scalability, Import/Export Scalability, Extension
Scalability), and CONTRIBUTING "Performance Guidelines". Traceability to those
requirements is noted per milestone.

## Guiding principles (from the docs)

- **Measure before optimizing.** CONTRIBUTING: "Avoid optimizing prematurely,
  but do not ignore performance implications." So a benchmark baseline comes
  first (6.1); every later milestone is judged against it.
- **Regressions are architectural issues.** ARCHITECTURE Performance Budget:
  "Performance regressions should be treated as architectural issues" — so the
  phase ends with CI guardrails (6.8), not just one-off wins.
- **No API breakage.** ARCHITECTURE: "Optimizations should preserve API
  stability and maintainability whenever possible." All Phase 6 work is internal
  or additive — no public contract changes.
- **Predictable scaling over peak numbers.** ARCHITECTURE Scalability Strategy:
  favor solutions "whose performance characteristics remain predictable as
  documents and feature sets grow" — flat curves beat lucky constants.
- **Typing latency is sacred.** PROJECT_SPEC: "Typing performance should never
  degrade regardless of editor complexity." It is the primary metric.

## What already exists (the baseline)

Phase 6 starts from a deliberately performance-friendly base — the job is to
verify, measure, and close gaps, not to retrofit:

- **Packages are split and tree-shakeable.** Every package sets
  `sideEffects: false`; core (~18 KB gzip barrel) and react (~12 KB gzip barrel)
  are small; heavy optional formats ship as separate packages
  (`docs-editor-markdown`, `docs-editor-docx`) and are lazy-loadable via dynamic
  `import()` (the playground already does this for DOCX).
- **Incremental rendering** is inherited from the internal ProseMirror engine
  (it diffs and mutates only changed DOM); the React adapter is a thin layer
  over it, with state and dispatch on **separate contexts** so a toolbar button
  does not re-render when the document changes.
- **History is bounded** (default depth 100) and undo/redo is event-grouped.
- **Decorations rebuild is memoized** by source + version, and pagination
  measurement is convergent (natural coordinates, one settling pass) with its
  `ResizeObserver` coalesced to one measurement per frame.
- **Serialization contracts are already async-tolerant** (generalized in Phase
  5.7), so a future streaming/chunked path is additive, not a redesign.

What is missing is the thing the docs ask for most: a **repeatable way to
measure** all of this, a set of **large-document fixtures**, and **enforced
budgets**. That is where the phase begins.

## Milestone 6.1 — Benchmark harness, fixtures & baseline (measure first) ✅

**Complete.** The foundation. Nothing was optimized here — this milestone makes
performance *observable and repeatable* so every later change is judged against
a number. Results and method: [docs/PERFORMANCE.md](./PERFORMANCE.md).

- **Large-document fixtures.** A deterministic generator producing documents of
  configurable scale (e.g. 10 / 100 / 1000 / 5000 paragraphs; 100+ page docs;
  large tables; hundreds of images; deep nesting; long histories) — matching
  ARCHITECTURE "Large Documents" and PROJECT_SPEC "Performance Goals".
- **Micro-benchmarks** for the core hot paths: `EditorState.apply` (single
  keystroke), transaction construction, JSON/HTML/Markdown/DOCX serialization
  throughput, decoration set rebuild, and pagination measurement. Runner:
  Vitest `bench` (already in the toolchain) — no new heavy dependency.
- **Interaction timing** (playground, Playwright): typing latency, scroll,
  selection, undo/redo, and paginated-edit latency on a large fixture.
- **Bundle-size measurement**: per-package gzipped size of the public barrel and
  a "minimal editor" entry (one command imported), captured as numbers.
- **Baseline report** committed to `docs/` (a PERFORMANCE.md), recording the
  starting numbers for typing/transaction/serialization/pagination latency and
  bundle sizes, plus the method to reproduce them.

Traces: PROJECT_SPEC Performance Goals; ARCHITECTURE Performance Budget
("continuously monitor and optimize"); ARCHITECTURE Testing "Performance
Benchmarks".

Exit: reproducible benchmarks + fixtures exist; baseline numbers recorded; the
harness runs locally (and is CI-ready for 6.8).

## Milestone 6.2 — Transaction & state efficiency (typing latency) ✅

**Complete.** The eager document conversion identified in 6.1 is fixed:
`EditorState.doc` is now a lazily-computed, memoized getter, and the
engine→model conversion walks ProseMirror nodes directly (no intermediate
`toJSON()` tree) with per-node `WeakMap` memoization. Because ProseMirror
documents are persistent, an edit reuses the identical objects for untouched
subtrees, so conversion cost tracks the *change* rather than the *document*.

Measured: keystroke `apply` at 5000 paragraphs went 4.588 ms → **0.021 ms**
(~218×); a selection change is now flat at **0.0004 ms** at every scale
(~11,900× at `huge`). Locked in by `src/state/structural-sharing.test.ts`.

Bonus: untouched subtrees now keep object identity, so `state.doc` identity is a
valid change signal and `React.memo`/`useMemo` over document nodes finally skip
work.

Open follow-up: real-browser typing on a 67-page document did **not** improve
(~9 ms/keystroke), because `apply` is no longer the bottleneck there —
pagination was measured at only ~0.7 ms of it, so the remainder is ProseMirror
DOM reconciliation plus browser layout. That is now 6.3/6.4 work, to be started
from profiling rather than assumption (see docs/PERFORMANCE.md finding 6).

Original scope — make the per-keystroke path allocation-light and
re-render-free.

- Profile `EditorState.apply`, `Transaction` construction, and the React
  reducer under the 6.1 fixtures; remove avoidable per-keystroke allocations and
  redundant document traversals.
- Verify (and, if needed, tighten) that dispatching a transaction re-renders
  only the document consumers — not toolbars, menus, or the page chrome — via
  the split state/dispatch contexts and stable callback identities.
- Confirm structural sharing: unchanged subtrees are reused across
  transactions (the model is immutable) so apply cost tracks the *change* size,
  not the *document* size.

Traces: PROJECT_SPEC "Performance First" (typing never degrades); ARCHITECTURE
"Efficient transactions", "Minimal rerenders", "Structural sharing".

Exit: typing latency stays flat as the document grows (target: comfortably
within one frame per keystroke on a 1000-paragraph doc); no unrelated component
re-renders on typing (asserted by a test).

## Milestone 6.3 — Rendering efficiency (adapter + view) ✅

**Complete — and the honest outcome is that there was nothing to optimize.**

A V8 sampling profile of typing on a 1000-paragraph document attributes only
**~2 ms of a ~12.7 ms keystroke to JavaScript we control**; the rest is browser
layout, paint, and native `Selection.collapse` (which forces a synchronous
reflow of a very tall document). Combined with 6.1's finding that active-state
queries are already flat and free, there is no meaningful JS left to remove
here.

The adapter was therefore audited rather than rewritten, and confirmed correct:
the view is constructed once and synced via `updateState()`, and
renderer maps/keymap are captured at mount so inline object literals cannot
remount it. Both properties are now locked by regression tests in
`editor.test.tsx` — breaking either would drop DOM selection and IME state on
every keystroke while still passing every functional test.

Two results carried into later milestones:

- The only real lever on the remaining cost is **rendering less DOM**, which is
  precisely the viewport-virtualization question in 6.4 — now to be decided on
  profile data rather than instinct.
- **Live pagination costs ~2.8 ms/keystroke at human typing speed** (11.45 ms
  vs 8.65 ms with it off). The earlier "~0.7 ms" figure was an artifact of
  typing as fast as the harness allows, which lets pagination's per-frame
  coalescing merge many keystrokes into one measurement. This makes incremental
  measurement a genuine win and firms up 6.4's scope.

Original scope — ensure the adapter never defeats the engine's incremental DOM,
and that query/active-state hooks do not thrash.

- Audit that the view is created once and updated via stable props (no view
  re-creation on unrelated renders); memoize the renderer maps and keymap.
- Review `useActiveMarks` / `useIsMarkActive` / `useActiveBlockType` re-render
  frequency; introduce memoized selection-derived selectors so they recompute
  only when the relevant slice changes.
- Confirm no full-document re-render on typing, selection, or decoration
  changes; verify decoration application (search, pagination) redraws only
  affected ranges.

Traces: ARCHITECTURE "Rendering Scalability" (update only affected portions,
avoid full re-renders), "Memoization where appropriate", "Avoid unnecessary DOM
mutations".

Exit: no full-document re-render on common edits; active-state hooks measured
and bounded; render latency flat with document size.

## Milestone 6.4 — Large-document & pagination performance ✅

**Complete — though not in the way the plan assumed.** The premise was that
re-scanning every block is the cost, so measurement should become incremental.
Measured directly, a full pass over 1000 blocks is **0.61 ms** — pagination was
*scheduling*-bound, not measurement-bound: the pass ran on every keystroke.

Fix: re-paginate when typing **pauses** (120 ms quiet window) with a 500 ms
ceiling so sustained input cannot starve it. Pagination's per-keystroke cost
fell from **2.80 ms to 0.75 ms** (~73%), with a deliberate trade — one-off
pagination after importing a 67-page document went ~220 ms → ~460 ms. Typing is
continuous and user-facing; import is not, and PROJECT_SPEC is explicit that
typing must never degrade.

Incremental measurement was therefore **not built**: at 0.61 ms a pass, run once
per pause instead of per keystroke, it would optimize something that is no
longer on the critical path. The complexity is not justified by the data.

Two attempts measured and rejected (kept in docs/PERFORMANCE.md so they are not
retried): swapping `getBoundingClientRect()` for `offsetTop`/`offsetHeight` *for
speed* (it is marginally slower, not faster — the swap was kept only because it
removes zoom scale-correction), and fast-pathing the convergence pass to recover
the slower import (it let the measure → apply → observe cycle re-enter without
settling, leaving content permanently in motion).

**Viewport virtualization remains deferred**, now on evidence: 6.3's profile
shows the residual cost is browser layout and native selection sync, and
virtualizing an editable surface risks selection, find, and scroll correctness.
It should only be revisited if a concrete large-document complaint survives the
current numbers.

Original scope — the pagination measurement re-scans every top-level block on
change; make it incremental and cheap.

- **Incremental measurement**: cache block heights and re-measure only from the
  first changed block downward instead of the whole document; skip entirely when
  neither content nor layout affecting geometry changed.
- Debounce/coalesce measurement under sustained typing; ensure the convergence
  pass cannot thrash under rapid edits.
- Stress typing, scrolling, and selection inside a paginated 100-page fixture;
  keep the editor smooth.
- **Evaluate viewport virtualization** for very large documents as a documented
  investigation. Recommendation: keep it a *measured decision* — implement only
  if 6.1 baselines prove ProseMirror's native rendering insufficient, because
  virtualizing an editable surface risks selection/scroll/find correctness (see
  Open decisions).

Traces: ARCHITECTURE "Large Documents", "Rendering Scalability", "Efficient
document traversal", "Virtualization where appropriate".

Exit: pagination recompute stays within one frame for an edit on a 100-page
doc; typing in a large paginated document stays smooth; virtualization decision
recorded with data.

## Milestone 6.5 — Memory management & leak audit ✅

**Complete — audited, measured, and pinned by tests.** No leaks were found, so
the deliverable is the evidence plus the regression tests that keep it true.

Measured in Chromium on a 1000-paragraph (67-page) document, collecting garbage
before each reading: 120 edit/undo cycles grew the heap 8.8 → 9.4 MB (4.8
KB/cycle, the undo history filling to its cap and plateauing), and three full
document replacements grew it 6.9 → 7.5 MB. Both bounded, not accumulating —
confirming old documents are collected, including the per-node conversion cache
from 6.2 whose `WeakMap` keys become unreachable with the engine nodes they key
on. A whole 67-page document costs roughly 9 MB of heap.

Pinned by tests, because a leak passes every functional test:
`state/memory-bounds.test.ts` (history depth cap holds as editing continues; 20
mount/destroy cycles leave no DOM; clearing decorations after destroy is a no-op
rather than a throw) and `page/pagination-cleanup.test.tsx` (live pagination
disconnects its `ResizeObserver` and leaves no pending timer or animation frame
on unmount — a leaked observer would keep firing against a destroyed editor for
the life of the page).

Original scope — keep memory growth predictable over long sessions.

- Audit teardown: `EditorView.destroy` removes listeners and detaches DOM; the
  pagination `ResizeObserver` disconnects; decoration holders (a `WeakMap`) do
  not retain destroyed views; provider effects clean up.
- Verify history memory is bounded (depth cap) and does not grow unbounded
  during long editing.
- Long-session memory profile against a large fixture (repeated edit/undo/redo
  cycles); add teardown/cleanup regression tests.

Traces: ARCHITECTURE "Memory Management" (no duplicated state, no retained
detached DOM, no leaks, no unbounded history); CONTRIBUTING "memory usage".

Exit: stable memory across an extended editing session; no retained detached
nodes or listeners after `destroy`; history provably bounded.

## Milestone 6.6 — Bundle size, tree-shaking & code splitting ✅

**Complete.** 6.1's finding — that a headless bundle (73.5 KB) weighed almost
the same as a full React editor (74.1 KB) — was traced with a new
`scripts/explain-bundle.mjs` diagnostic to a single line: `createEngineState`
statically imported the table-editing plugin to support a `tables: true` flag,
and a reference inside `if (options.tables)` is one no bundler can prove
unreachable. Every `EditorState` therefore dragged in `prosemirror-tables` and,
through it, `prosemirror-view`.

Table editing now lives behind its own entry point and is **passed in** rather
than switched on:

```ts
import { EditorState } from "@sbh321/docs-editor-core";
import { tableEditing } from "@sbh321/docs-editor-core/tables";

EditorState.create({ schema, doc, tables: tableEditing });
```

| Scenario | Before | After |
| --- | ---: | ---: |
| headless (schema + state + one command) | 73.5 KB gz | **36.0 KB gz** (−51%) |
| react: minimum real editor | 74.1 KB gz | 71.3 KB gz |

**This is a breaking change** — `tables: true` no longer compiles — taken
deliberately while the package is pre-release, when it is cheapest, and
justified per CLAUDE.md's breaking-change rules: it is the same principle that
document says out loud, that plugins should extend the core rather than be baked
into it. Migration is one import; the table *commands* stay on the main entry.
The engine boundary is preserved — `EditorPlugin` is opaque and its internals
are stripped from the published types, so no ProseMirror type crosses the
boundary.

Tree-shaking is otherwise confirmed working (`createSchema` alone is 24.4 KB
against 79.4 KB for the full barrel), and the heavy optional formats stay out of
the core path: Markdown and DOCX are separate packages, and DOCX (263 KB gz —
3.5× the whole editor) is lazy-loaded via dynamic `import()` in the playground.

Original scope — make the shipped footprint small, measured, and enforced.

- Add a **bundle-size budget** (e.g. `size-limit`) per public package and for a
  "minimal editor" import, wired to fail on regression.
- Verify tree-shaking end-to-end: importing a single command/primitive pulls in
  only its dependencies (barrel exports must not defeat shaking) — the
  `sideEffects: false` flags are in place; this proves them.
- Confirm optional heavy features stay out of the core path (Markdown/DOCX are
  separate packages; document the lazy-load pattern the playground uses).
- Audit the ProseMirror footprint and the playground's ~630 KB main chunk;
  document the editor's realistic minimal bundle.

Traces: PROJECT_SPEC "Small bundle size", "Tree-shakeable packages", "Fast
initial load"; ARCHITECTURE "Lazy loading", "Code splitting", "Tree shaking".

Exit: documented, enforced bundle budgets; tree-shaking verified by a test;
minimal-editor footprint published.

## Milestone 6.7 — Serialization & import/export performance ✅

**Complete — measured, and nothing needed optimizing.**

6.1's jsdom benchmarks made HTML import look like the clear bottleneck (58.7 ms
against 2.2 ms for validated JSON import, a 26× gap). Measured in a real browser
that ranking **inverted**: HTML is the fastest of the three text formats and JSON
the slowest, because native DOM parsing is quick while JSON's larger payload
(178 KB vs 71 KB) costs more to parse and re-validate. Benchmarking DOM-touching
code under jsdom measures jsdom.

End-to-end, user-visible latency for a 1000-paragraph (67-page) document —
including React re-render, editor remount and re-pagination, not just the codec:

| Format | Export | Import |
| --- | ---: | ---: |
| JSON | 91 ms | 114 ms |
| HTML | 70 ms | 81 ms |
| Markdown | 81 ms | 87 ms |
| DOCX | 187 ms (incl. lazy-loading the package) | — |

**Streaming and chunked execution stay deferred**, now on evidence: every format
finishes an explicit, user-triggered operation in under 200 ms, far below the
~1 s where progress feedback and cancellation start to matter. Documented
threshold for revisiting: **~500 ms**, roughly 300+ pages. The Phase 5.7
contracts are already async-tolerant, so it stays additive.

No inefficiency was fixed here because the one that existed was already gone:
the engine→model conversion used to traverse and allocate the whole document
twice, fixed in 6.2. Optimizing further would be premature against this data.

Original scope — measure the cost of moving large documents in and out, and keep
it off the critical path.

- Benchmark JSON/HTML/Markdown/DOCX export and import on the large fixtures
  (throughput and main-thread block time).
- Fix obvious inefficiencies (avoidable copies, repeated traversals) in the
  exporters/importers.
- **Streaming/chunked execution decision**: the contracts already allow it
  (Phase 5.7). Recommendation: keep synchronous implementations, and add
  chunked/yielding execution only if benchmarks show an unacceptable block at
  the "100+ page" target — otherwise document the size threshold and defer (as
  Phase 5 already planned). Record the decision with data.

Traces: ARCHITECTURE "Import and Export Scalability" (streaming, chunked
processing, progress, cancellation, future background execution); "Serialization
performance"; CONTRIBUTING "serialization costs".

Exit: serialization throughput measured and acceptable at the 100-page target;
main-thread block within an agreed budget; streaming decision recorded.

## Milestone 6.8 — Regression guardrails & documentation ✅

**Complete.** `pnpm size:check` enforces a gzip budget for every published
package and every realistic consumer bundle, and runs in CI after the build —
a breach fails the workflow and the error points at
`node scripts/explain-bundle.mjs <package>` to find what pulled the weight in.
Verified by deliberately breaking a budget and confirming a non-zero exit, so
the guardrail is known to fire rather than merely assumed to.

`docs/PERFORMANCE.md` carries the methodology, baselines, every finding, the
budgets, and the measured-and-rejected optimizations.

**One deliberate departure from the plan.** The plan said meaningful regressions
should fail the build. That is right for *size*, which is deterministic — the
same inputs produce the same bytes — but wrong for *timing*: the phase's own
measurements put the largest benchmarks at 25% relative margin of error (6.7),
and a shared CI runner is worse. Gating on a noisy signal only teaches people to
ignore the gate. So size is enforced, timings are tracked in PERFORMANCE.md and
checked by hand when a change needs judging.

Original scope — make the wins durable.

- Wire the 6.1 harness into CI: bundle-size budgets and key benchmarks run on
  PRs; meaningful regressions fail the build ("regressions are architectural
  issues").
- Publish `docs/PERFORMANCE.md`: methodology, baselines, budgets, and how to run
  the harness locally; note the targets and the deferred items.
- Update ARCHITECTURE/ROADMAP status and add a changeset; ensure no public API
  changed.

Traces: ARCHITECTURE Performance Budget ("regressions treated as architectural
issues"); Testing "Performance Benchmarks", "Regression Tests".

Exit: perf/size regressions are caught in CI; baselines and budgets documented;
no public API change.

## Deliberately deferred (with rationale)

- **Full editable virtualization** — evaluated in 6.4; only implemented if data
  demands it, because virtualizing the editable surface risks correctness
  (selection, scroll restoration, find, print). Default: rely on ProseMirror's
  native incremental rendering.
- **Streaming/chunked serialization & background (worker) execution** — the
  contracts allow it; ships only if 6.7 benchmarks require it, else deferred
  with a documented threshold. Web Worker offload is a later concern.
- **Mobile/virtual-keyboard optimization** — ARCHITECTURE lists it under future
  platforms; out of scope for this phase.
- **Collaboration/CRDT performance** — a future phase's concern; the
  architecture already anticipates it.

## Cross-cutting exit criteria (whole phase)

- A reproducible benchmark harness and large-document fixtures exist, with
  recorded baselines (6.1) and CI enforcement (6.8)
- Typing latency stays flat as the document grows to 100+ pages / thousands of
  paragraphs (PROJECT_SPEC Performance Goals)
- Common edits (typing, selection, formatting, undo/redo, scrolling) never
  trigger a full-document re-render; only affected regions update
- Memory is stable over extended sessions; no leaks or unbounded history
- Bundle budgets are documented and enforced; tree-shaking is verified; optional
  formats stay out of the core path
- No public API changed; all packages build, lint, typecheck, and test clean
  (unit + Playwright e2e + benchmarks)

## Open decisions to confirm before implementation

1. **Benchmark tooling** — Vitest `bench` for micro-benchmarks + Playwright for
   interaction timing (recommended, no new heavy deps) vs a dedicated tool
   (e.g. Tinybench/Tachometer).
2. **Virtualization** — evaluate-and-likely-defer (recommended) vs commit to
   implementing viewport virtualization this phase.
3. **Streaming serialization** — measure-and-defer with a documented threshold
   (recommended) vs implement chunked/async export now.
4. **CI perf gating strictness** — fail the build on regression (recommended,
   per the docs) vs report-only initially.

Target Version:

v0.7.0

---

# Phase 7 — Media

Status:

Complete — all eight milestones. Media is a first-class part of the document
model: node catalog, commands, upload lifecycle, ingestion policy, interactive
node views, serialization across HTML, print, DOCX and Markdown, scale
benchmarks against the Phase 6 budgets, and accessibility enforced as a gate
with keyboard-operable resize and alignment.

Objective:

Make media a first-class part of the document model — images, video, audio, file
attachments and embeds — provided by **the core**, including the asynchronous
upload lifecycle that every real editor needs and that a node type alone does
not give you.

PROJECT_SPEC lists Images (Upload, Paste, Drag & Drop, Resize, Alignment,
Caption, Alt Text) as a core capability, and **none of it exists yet**: Phase 3
added an `image`/`figure`/`caption` node *shape* to the playground's example
schema, but the core ships no media node catalog, no media commands, no upload
story, and no interactive resizing. This phase closes that gap and generalizes
it so other media types are cheap rather than bespoke.

## Scope boundary (read this first)

Media is where an editor is most tempted to grow application responsibilities.
CLAUDE.md is explicit that cloud storage, authentication and business logic
belong outside the editor, so the line is drawn deliberately:

- **`docs-editor-core` owns** the media node model, media commands, the upload
  *lifecycle and state machine*, ingestion primitives (extracting files from a
  paste or drop), serialization for every format, and an **upload contract**.
- **The application owns** actually moving bytes: upload transport, storage,
  CDN, authentication, virus scanning, image optimization, media libraries. The
  core defines the interface and never performs a network request or touches
  storage itself.
- **Framework adapters own** interaction and rendering: node views, drag-resize
  handles, progress and retry affordances, alt-text and caption editing UI.

The single most important consequence: **the core never fetches or stores.** An
application supplies a `MediaUploader`; the core drives it, tracks its progress,
and puts the result into the document.

## What already exists (the baseline)

- **Node shapes only, in the playground.** `image` (with `src`/`alt`), `figure`
  and `caption` exist in the example schema, rendered via `nodeRenderers`. There
  is no core media module.
- **Node views exist but are internal.** `createGenericNodeView` bridges a
  renderer function to a `prosemirror-view` `NodeView`, but the view layer
  exposes only `nodeRenderers` — no interaction hooks, so drag-to-resize is
  currently impossible without new public surface (see Open decisions).
- **Node selection works** (Phase 4.5): an image can already be selected as a
  unit, which is the prerequisite for resize/align/delete affordances.
- **Serialization partly handles images.** HTML export/import maps `<img>`
  through the renderer/parse specs, and import already sanitizes `javascript:`
  and `data:` URLs. **DOCX export degrades images to their alt text** — a
  documented Phase 5.7 limitation this phase should close.
- **Phase 6's harness can measure it**: the benchmark fixtures already generate
  documents containing hundreds of figures, and PROJECT_SPEC's performance goals
  name "hundreds of images" explicitly.

## Milestone 7.1 — Media model & schema foundation (core) ✅

- A **media node catalog** in core, so consumers stop hand-rolling media node
  specs: `image`, `video`, `audio`, `file` (attachment) and `embed`, expressed
  as reusable `NodeSpec` builders rather than a fixed schema (the core must stay
  schema-agnostic — it provides the shapes, the consumer composes them).
- A shared attribute vocabulary: `src`, `alt`, `title`, `width`, `height`,
  `align`, plus a stable `mediaId` used to correlate an in-flight upload with
  the node it belongs to.
- The `figure`/`caption` relationship generalized so any media type can carry a
  caption, rather than images only.
- Validation: alignment as a closed set, non-negative dimensions, required
  `alt` handling for accessibility (see 7.8).

## Milestone 7.2 — Media commands & queries (core) ✅

- `insertMedia`, `replaceMedia`, `removeMedia`.
- Attribute commands: `setMediaAlignment`, `setMediaSize` (aspect-ratio aware),
  `setMediaAlt`, `setMediaCaption` — built on the existing `Transaction`
  primitives, not new engine surface, following the Phase 5.8 `setMark`
  precedent.
- Queries: the selected media node and its attributes, so a toolbar can reflect
  state without reaching into the document.

## Milestone 7.3 — Upload lifecycle & the `MediaUploader` contract (core) ✅

The substantial milestone, and the one a node type alone does not solve.

- A `MediaUploader` contract the application implements:
  upload a file, report progress, support cancellation via `AbortSignal`,
  resolve to a final `src` (plus intrinsic dimensions where known).
- A **lifecycle state machine**: `pending → uploading → ready | failed`, with
  retry and cancel.
- **Position-stable completion.** An upload finishing must update the right
  node even though the user has kept typing and the node has moved. This is why
  nodes carry a `mediaId`: completion resolves the id to a current position
  rather than remembering a stale one.
- Local preview before upload completes (object URL), and — critically —
  **revoking it afterwards**, since leaked object URLs pin their blobs in memory
  for the page's lifetime (exactly the class of leak Phase 6.5 tests for).

## Milestone 7.4 — Ingestion: paste, drag & drop, and URLs (core + adapter) ✅ *(core half)*

- Core primitives to extract media files from clipboard and drop payloads, and
  to decide what is accepted (MIME allowlist, size limits) — pure functions over
  plain data, no DOM event handling in core.
- Adapter wiring for the actual `paste`/`drop` DOM events, including dropping at
  the cursor position rather than the end.
- Pasting a media **URL** inserts a media node rather than a link, where the
  consumer opts in.
- Multiple files in one gesture, inserted in order.
- **Security:** the same posture as HTML import — URLs are sanitized, nothing is
  auto-fetched, and no remote content is resolved to decide a node's type.

## Milestone 7.5 — Interactive rendering (react) ✅

- Media node views: selection affordance, **drag-to-resize handles** with
  aspect-ratio locking and min/max constraints, alignment affordances.
- Headless upload UI: progress, failure with retry, cancel — components that
  supply behaviour and leave presentation to the consumer, as Phase 4 did.
- Alt-text and caption editing UI.
- Requires deciding how much node-view surface the core exposes (see Open
  decisions) — this is the milestone that forces that call.

## Milestone 7.6 — Serialization across every format ✅

- **HTML** export/import for each media type (`img`, `video`, `audio`,
  `a[download]`, `iframe` for embeds), with sanitization on import and
  dimensions/alignment preserved.
- **Markdown**: images are native; video/audio/file degrade predictably and the
  loss is documented and tested, per the Phase 5 precedent.
- **DOCX**: real image embedding, closing the Phase 5.7 alt-text fallback. This
  needs binary asset plumbing (fetching the bytes for a `src` is the
  *application's* job — the exporter should accept a resolver rather than
  fetching).
- **Print/PDF**: sensible sizing and page-break behaviour around media.

## Milestone 7.7 — Scale, performance & memory ✅

- Extend the Phase 6 fixtures to media-heavy documents and measure against the
  budgets — PROJECT_SPEC asks for "hundreds of images".
- Lazy loading and `decoding` hints so a long document does not decode every
  image at once.
- Verify no object-URL or listener leaks across insert/undo/delete cycles,
  reusing the 6.5 memory harness.
- Keep the media node catalog out of bundles that do not use it, per the 6.6
  precedent (media should not become the next `prosemirror-tables`).

## Milestone 7.8 — Accessibility, docs, playground & verification ✅

- **Accessibility is a gate, not a nicety** (CLAUDE.md: accessibility
  regressions are bugs): alt text on every image, a deliberate decorative-image
  path, keyboard-operable resize and alignment, and screen-reader-sensible
  captions.
- Playground: upload (with a mock uploader), paste, drag & drop, resize, align,
  caption, alt text, and failure/retry — exercised by e2e.
- Docs: PROJECT_SPEC and ARCHITECTURE updated to match wherever this phase
  changes their stated position (see Open decision 2), package READMEs, and a
  changeset.

## Deliberately deferred

- **Third-party embed providers** (YouTube, Vimeo, X, Figma …) — provider
  resolution and oEmbed belong in a plugin or the application, not the core.
  The generic `embed` node is the extension point.
- **Media library / asset browser UI** — an application concern.
- **Image editing** (crop, rotate, filters) and **transcoding** — out of scope.
- **Video captions/subtitle tracks (WebVTT)** — a follow-up once video lands.
- **Resumable/chunked uploads** — the `MediaUploader` contract should not
  preclude it, but the core ships the simple case.

## Package ecosystem impact

- Media model, commands, lifecycle, ingestion primitives and serialization:
  **`docs-editor-core`**.
- Node views, resize interaction and headless upload UI:
  **`docs-editor-react`**.
- DOCX image embedding: **`@sbh321/docs-editor-docx`**.
- No new package is anticipated; if embed providers are ever built they belong
  in their own package, not here.

## Dependencies to evaluate (CLAUDE.md dependency policy)

Ideally **none**. Uploading is the application's; previews use `URL.createObjectURL`;
dimensions come from natural image/video metadata. Any proposal to add an image
processing or upload library should be rejected as an application concern.

## Locked decisions

Settled before implementation, so the milestones above are unambiguous:

1. **Upload state lives in an external registry**, keyed by `mediaId`, *not* in
   the document. Only the durable `mediaId` and final `src` are document data.
   Placeholder/progress/failure state is transient view state, so it never
   enters undo history and a document can never be serialized mid-upload — the
   same reasoning that keeps zoom and page layout out of the model.
2. **Video, audio, file and embed are built in core**, on the shared media
   foundation, alongside images. The marginal cost over images alone is small
   and the alternative — five near-identical implementations in userland — is
   worse. PROJECT_SPEC and ARCHITECTURE are updated to match, rather than left
   contradicting this.
3. **The core exposes a full node-view API**, and drag-to-resize is built on it.
   An adapter-side overlay would have to re-derive geometry the engine already
   knows and drifts out of sync during edits; a documented node-view interface
   is the honest surface, and it is what any interactive node type will need.
4. **DOCX image embedding takes an application-supplied asset resolver.** Real
   embedding needs bytes, and fetching them is the application's job — the same
   boundary as the `MediaUploader`. The exporter asks for bytes; it never
   retrieves them itself.

Exit Criteria:

- Images, video, audio, file attachments and embeds are first-class document
  nodes with commands, validation and full serialization
- Upload works end to end through an application-supplied `MediaUploader`, with
  progress, cancellation, retry, and correct completion even when the document
  has changed underneath it
- Paste and drag & drop insert media at the cursor, with an accepted-type policy
- Media can be resized, aligned, captioned and given alt text, by mouse **and**
  keyboard
- The core performs no network request and no storage access
- Media round-trips through HTML and print, embeds properly in DOCX, and
  degrades predictably in Markdown with the loss documented and tested
- Media-heavy documents stay within the Phase 6 performance budgets, with no
  object-URL or listener leaks
- All packages build, lint, typecheck, and test clean (unit + Playwright e2e)

Target Version:

v0.8.0

---

# Phase 8 — Batteries-Included Editor

Status:

In progress — Milestones 8.1–8.2 complete. The default preset ships behind
`@sbh321/docs-editor-core/preset`, and the playground builds on it with its e2e
suite passing unchanged. The new `@sbh321/docs-editor` package exists with its
design-token stylesheet, light/dark resolve out of the box with WCAG AA verified
in both schemes, the styled primitives are in place, and the composed editor
Complete — all seven milestones. `@sbh321/docs-editor` ships a styled,
assembled editor that renders from three lines, built on a framework-agnostic
default preset in the core and a design-token stylesheet with light and dark
verified to WCAG AA. The headless packages are unchanged and unenlarged: the
size budgets record that `headless state` and `editor, no media` did not move a
byte across the whole phase.

Objective:

Make Docs Editor usable in **three lines of code** without giving up the
headless architecture that the previous seven phases built.

```tsx
import { DocsEditor } from "@sbh321/docs-editor";
import "@sbh321/docs-editor/styles.css";

export default () => <DocsEditor />;
```

## The problem, measured

The playground is the only thing that has ever assembled a complete editor from
these packages, and it takes **~1,800 lines** to do it. Categorised:

| What it is | Lines | Should a consumer write this? |
| --- | ---: | --- |
| Schema, node/mark renderers, HTML parse spec, insert commands | ~247 | No — identical for everyone, and not React-specific |
| Toolbar, menus, panels, colour/font pickers, media controls, layout | ~742 | No — this is the editor's UI |
| Stylesheet | ~500 of 573 | No |
| Uploader, file dialogs, print trigger, initial document | ~146 | **Yes** — genuine application concerns |

So roughly **1,490 of 1,800 lines are boilerplate every consumer would rewrite**,
and only ~150 lines are actually theirs. PROJECT_SPEC promises "excellent
developer experience"; today the shortest path to a working editor is to copy a
1,200-line file.

## Why this is not simply "move it into docs-editor-react"

That would solve the DX problem and break the architecture. CLAUDE.md requires
React to stay a thin adapter whose UI layer is "presentation and interaction
only", and three concrete things go wrong:

1. A consumer wanting the primitives with their own design system would be
   forced to download an opinionated schema, a full styled UI and an icon set.
   `react: full barrel` sits at 97.4 KB against a 105 KB budget — this breaches
   it with no opt-out, which is exactly the `prosemirror-tables` failure mode
   Milestone 6.6 was created to prevent.
2. The default schema, renderers and parse spec are **framework-agnostic data**.
   Putting them in a React package makes them unusable from the Markdown/DOCX
   exporters, from a server-side render, or from a future Vue adapter.
3. "Headless" stops being true, and it is the project's stated identity.

Batteries-included and headless only conflict when they are the same package.

## Architecture

```
docs-editor-core            headless engine                    (unchanged)
  └── core/preset           default schema + renderers          (NEW subpath)
docs-editor-react           thin adapter, headless primitives   (unchanged)
  └── docs-editor           styled UI + <DocsEditor>            (NEW package)
```

Dependency direction still flows inward, and nothing existing changes
behaviour. The preset ships as a **core subpath export** rather than a new
package, following the `docs-editor-core/tables` precedent: it tree-shakes, and
it stays usable headlessly and framework-agnostically.

Three escape hatches, in descending order of control:

| Need | Use |
| --- | --- |
| A working editor | `<DocsEditor />` |
| Our styled parts, your layout | `@sbh321/docs-editor/ui` |
| Your design system | `@sbh321/docs-editor-react` primitives |

## Locked decisions

1. **A new `@sbh321/docs-editor` package**, not an expansion of
   `docs-editor-react`. Consumers install one package; the layering is our
   problem, not theirs.
2. **Plain CSS with design tokens**, not Tailwind and not a copy-paste CLI.
   shadcn/ui is not an installable package — it is a CLI that copies source and
   requires Tailwind, and both fight "install and plug in". We take its *visual
   language* (Radix-style primitives, neutral palette, subtle borders, a
   `--radius`/`--muted` token vocabulary, visible focus rings) and ship it as
   one stylesheet with custom properties. No build configuration; retheme by
   overriding tokens. This also keeps CLAUDE.md's rule that the editor must not
   depend on Tailwind. A shadcn-style eject CLI stays possible later.
3. **A full default schema, extensible.** `<DocsEditor />` with no props is a
   complete editor — text, lists, tables, media, code, colours, fonts, page
   layout. `extendDefaultSchema()` adds to it. Shipping a minimal schema with
   opt-in modules would make the out-of-box experience feel unfinished, which is
   the thing this phase exists to fix.

## Scope boundary

The new package is where *opinions* live. It must not become where *behaviour*
lives: every button still delegates to a core command, exactly as the Phase 4
headless UI does. If a feature needs new editing behaviour, that behaviour
belongs in the core and only its presentation belongs here.

Application concerns stay in the application, unchanged: upload transport,
storage, authentication, persistence, routing. `<DocsEditor />` accepts an
`uploader`, an `onChange`, and an initial document — it does not acquire them.

## Milestone 8.1 — Default preset (`docs-editor-core/preset`) ✅

- Default schema covering everything the playground declares today, exported as
  `defaultSchema` plus `extendDefaultSchema()` for additive customisation.
- Matching `defaultNodeRenderers` / `defaultMarkRenderers` / `defaultParseSpec`
  / `defaultKeymap`, so on-screen rendering, HTML export, print and paste all
  agree by construction rather than by the consumer keeping four maps in sync.
- Framework-agnostic and headless: no React import, usable from Node.
- The playground switches to it and must render identically — that is the test
  that the preset really is what the playground had.

## Milestone 8.2 — Design tokens & theming ✅

- A token vocabulary (`--de-*`: colour, radius, spacing, typography, elevation,
  focus ring) with a shadcn-inspired neutral palette.
- **Light and dark out of the box**: `@media (prefers-color-scheme: dark)` as
  the default signal, with `[data-theme="light"|"dark"]` overriding it in both
  directions so system-follow and an explicit toggle both work.
- `ThemeProvider` (Phase 4) extended to drive `data-theme` and expose the
  resolved theme, plus a `useColorScheme()` hook. It already turns tokens into
  CSS custom properties, so this is an extension rather than a rewrite.
- Contrast verified against WCAG AA in both schemes — accessibility is a gate
  (CLAUDE.md), and a dark theme is where contrast quietly fails.

## Milestone 8.3 — Styled primitives (`@sbh321/docs-editor`) ✅

Styled counterparts to the headless primitives, built on them rather than
replacing them: Button, IconButton, Toggle, Select, Dropdown, Popover, Dialog,
Tooltip, Input, Tabs, Separator, ScrollArea.

- Every component takes `className` and merges it, so consumers can adjust
  without forking.
- Keyboard navigation and focus management are part of the definition of done,
  not a follow-up.
- No new editing behaviour. Anything that edits calls a core command.

## Milestone 8.4 — Composed editor surfaces ✅

The pieces the playground currently hand-rolls, as real components: main
toolbar (with overflow handling — the current one simply overflows), floating
selection toolbar, slash menu, context menu, table controls, media controls,
find & replace, outline/TOC sidebar, page setup, zoom, status bar.

Each is independently usable and independently themeable.

## Milestone 8.5 — `EditorShell` and `<DocsEditor>` ✅

- `EditorShell`: a CSS-grid application frame that fills the viewport
  (`100dvh`) — toolbar row, optional sidebar, scrollable canvas, status bar —
  and is responsive down to a phone.
- **Filling the screen and the page metaphor are not in conflict**: the shell
  owns the chrome, and the A4 `PageSurface` sits centred inside the scrollable
  canvas. That is what Word and Google Docs do — the application fills the
  window, the document still looks like paper.
- `<DocsEditor>`: shell + preset + UI + providers, with props for the things
  that are genuinely the application's (`initialDocument`, `onChange`,
  `uploader`, `theme`, `schema`, `readOnly`).

## Milestone 8.6 — Playground reduction (the acceptance test) ✅

**Correction to this criterion, recorded after the fact.** "Every existing e2e
test passes unchanged" was the wrong bar: it conflated API correctness with UI
*stability*. Replacing a hand-rolled UI with a designed one necessarily changes
labels and structure — six heading buttons became a select, individual insert
buttons became a menu — none of which indicates a bad API.

What was actually delivered:

- `examples/basic-react` is **13 lines**, which is where the three-line claim is
  proved.
- The playground demonstrates the *middle* tier — `EditorShell` plus the
  surfaces, composed by hand — and went from **1,038 lines in one file to 296**,
  with ~180 of the remainder being genuinely application-owned import/export and
  a mock uploader.
- The e2e suite was **rationalized from 56 tests to 35**: what only a browser can
  prove (contenteditable, real layout, pagination, print, file pickers, the
  upload lifecycle, keyboard resize, toolbar overflow) was kept; what is now
  covered by the UI package's 98 unit tests was dropped rather than duplicated.

The app stays in the repository rather than being deleted: it keeps proving the
escape hatches work, and a second example demonstrates composing
`@sbh321/docs-editor/ui` with a custom layout.

## Milestone 8.7 — Size, docs & verification ✅

- New budgets for the new package; **`react: full barrel` and the headless
  scenarios must not move**, which is the measurable proof that nobody pays for
  the batteries unless they install them.
- README rewritten around the three-line quick start; a "which layer should I
  use?" guide; theming and token reference; a migration note for anyone who
  built against the primitives.
- PROJECT_SPEC and ARCHITECTURE updated for the new package and its boundary.

## Deliberately deferred

- **A shadcn-style eject CLI.** Possible later; not required for "install a
  package and plug it in", and it introduces an upgrade-by-hand-merge problem.
- **Tailwind preset.** Can be added alongside the stylesheet if there is demand;
  it must never become the only way to style the editor.
- **Additional themes** beyond light/dark. The token vocabulary is the
  extension point.

Exit Criteria:

- A new React app renders a complete, styled editor in three lines
- Light and dark both work with no configuration
- The shell fills the viewport and is responsive
- The playground is under ~50 lines with its e2e suite unchanged
- Headless bundle budgets are unmoved
- Documentation, examples and specs updated

Target Version:

v0.9.0

---

# Phase 9 — Rich Formatting & Interaction

Status:

Complete — all milestones, including two added mid-phase by inspection. 9.9
fixed eight toolbar controls that rendered as empty squares (no `iconName`,
mounted only in contextual states no test looked at). 9.10 restored the
product's founding promise after this phase had eroded it: every feature the
phase added had been wired in the *playground*, so `<DocsEditor />` consumers
got none of them.

9.11 then finished the job the same way: print and import/export, misfiled as
application concerns for two phases, became the File menu.

Delivered: paragraph formatting, font size, a real link editor, task lists and
list styles, block reordering by drag *and* keyboard, a listbox `Select`, a
`Checkbox`, tooltips throughout, an icon-first toolbar — all reachable from
`<DocsEditor />` with no assembly. Two defects found while measuring were fixed
rather than filed: the link button applied an empty `href`, and link URLs were
unsanitized on export.

Objective:

Close the gap between "a working editor" and "an editor people will actually
write documents in": paragraph formatting, a real link experience, richer
lists, direct manipulation, and a primitive set polished enough that every
control looks like it belongs to the same product.

Phase 4.5 deferred most of this deliberately, naming it as work for "a feature
milestone of their own":

> Font color / background color, and paragraph formatting (alignment, line
> height, indentation, spacing, direction) — node/mark _attributes_ +
> commands; a feature milestone of their own.
>
> Task lists / checklists, page breaks, super/subscript, syntax highlighting —
> additional node/mark types, added when there's a concrete need.

This is that milestone, and that need.

## The gap, measured

Several requested features turned out to already exist in the core with no UI
attached, which changes what this phase is: less engine work than it looks,
more surfacing.

| Capability | Engine | UI |
| --- | --- | --- |
| Clear formatting | ✅ `removeFormatting`, bound to `Mod-\` | ❌ no control |
| Nested lists | ✅ `liftListItem` / `sinkListItem` / `splitListItem`, Tab bound | ❌ no control |
| Tooltips | ✅ `Tooltip` primitive | ❌ used in **1** place repo-wide |
| Button weights | ✅ `ghost \| outline \| primary \| destructive` | — naming mismatch only |
| Alignment, indent | ❌ | ❌ |
| Font size | ❌ | ❌ |
| Task lists, list styles | ❌ | ❌ |
| Drag and drop | ❌ — zero `dataTransfer` references in the repo | ❌ |

Two defects surfaced while measuring, and are fixed as part of this phase
rather than filed away:

**Insert Link applies an empty href.** The toolbar runs
`toggleMark("link", { href: "" })`. It marks text as a link and stops — there is
no dialog, no way to read or edit an existing link's target, and no `title` or
`target`. This is the feature that most obviously "just changes styles".

**Link `href` is not sanitized on export.** `defaultMarkRenderers.link` emits
`attrString(mark.attrs, "href", "")` verbatim, while media `src` goes through
`isSafeMediaUrl` in both directions. A `javascript:` URL that survives an HTML
import therefore reaches exported markup. Same bug class we already closed for
media, still open for links — PROJECT_SPEC's "prevent unsafe serialization"
applies to both.

## Locked decisions

**Font size is stored in points.** `font_size: { attrs: { size: { default: 11 } } }`
means 11pt. The alternative was pixels, matching the current 16px stylesheet
default. Points won because this is a _document_ editor: page layout is already
in physical units, DOCX stores half-points so the round-trip is exact rather
than rounded, and the numbers in the toolbar match what Word and Google Docs
show for the same document. The stylesheet's 16px body default becomes 12pt.

**Dropdowns become a custom ARIA listbox.** A native `<select>` cannot be
styled cross-platform — its popup ignores the dark theme on most platforms, and
it cannot render a font name in its own face or a colour as a swatch, which are
exactly the dropdowns this phase needs. The cost is real and accepted: the full
listbox keyboard contract (arrows with wrap, Home/End, type-ahead, Escape,
Enter/Space) is now ours to implement and ours to test, where the native
element gave it away for free.

**Drag-to-reorder covers every block, not just media.** A handle appears in the
margin on hover. Generalising costs one node-move transaction rather than a
media-specific one, and reordering a paragraph is a more common need than
reordering an image. A drag-only affordance would be an accessibility
regression, so the same move is reachable from the keyboard.

**Button variants are added, not renamed.** `secondary` joins the set. `ghost`
already _is_ the quietest weight and `outline` the second — the shipped API was
a naming mismatch, not a missing capability, and renaming a public type to fix
vocabulary would break every consumer for no behavioural gain.

## Milestone 9.1 — Paragraph formatting (core)

`align` and `indent` as block **attributes**, not marks: both describe a whole
block, and a mark spanning half a paragraph would be meaningless.

One pair of `indent` / `outdent` commands, list-aware. Inside a list they
delegate to `sinkListItem` / `liftListItem`; elsewhere they change the
attribute. This matters more than it looks: an indent _attribute_ applied to a
list item would render as indented while remaining a structural sibling,
silently breaking Markdown and DOCX export and the outline. One command, two
correct behaviours, chosen by context.

## Milestone 9.2 — Inline formatting & links (core)

The `font_size` mark, and links rebuilt: `setLink` / `updateLink` /
`removeLink`, href normalization (a bare `example.com` becomes `https://`),
sanitization on the way in and out, and `title` / `target` / `rel`. The export
gap above closes here, with a regression test for the `javascript:` case.

`removeFormatting` currently clears marks only and declines on an empty
selection. It is extended to reset the block attributes this phase introduces,
so "clear formatting" means what a user expects rather than what the engine
happened to implement.

## Milestone 9.3 — Lists (core)

`task_list` / `task_item` with a `checked` attribute, kept as their own node
types rather than a flag on `list_item`: a checklist serializes differently in
every format, and `checked: null` on every ordinary bullet would be noise in
the model that every exporter has to step around.

Plus `toggleList` (convert between list types without unwrapping first) and
list-style attributes — disc/circle/square, decimal/alpha/roman — with
Markdown, DOCX and HTML wired for all of it.

## Milestone 9.4 — Drag and drop (core + react)

Files dropped onto the document upload and insert through the existing
`MediaUploadRegistry`. Blocks gain a margin drag handle and a drop indicator,
built on a generic node-move transaction, with a keyboard path to the same
operation.

## Milestone 9.5 — Primitives (ui)

A `Checkbox` primitive, the listbox `Select`, and the `secondary` variant. The
listbox's keyboard contract is tested directly — it is the part a custom
implementation gets wrong, and the part users notice last and hate most.

## Milestone 9.6 — Controls (ui)

The font-size stepper (`− 11 +`, the number opening a preset list), alignment,
the expanded list group, indent/outdent, clear formatting, and a link editor
that reads the link under the cursor and edits it, rather than applying an
empty one.

## Milestone 9.7 — Icons & tooltips

Every icon-only control gets a tooltip carrying its name and keyboard shortcut,
and the remaining text buttons become icon buttons. The risk being watched:
tooltips must not duplicate the accessible name or disturb the toolbar's roving
focus — a tooltip that becomes the button's second name makes a screen reader
say everything twice.

## Milestone 9.10 — Batteries parity

The phase's features were landing in the playground instead of in
`<DocsEditor />` — the exact failure Phase 8 existed to end, recurring one
phase later. The correction, stated as an invariant rather than a fix: **if a
feature needs code in the playground to work, that is a gap in the package.**

Moved into `<DocsEditor />`: the slash menu (with a complete default item set,
`defaultSlashItems()`), the page-layout panel behind a toolbar Layout button,
the whole upload flow behind a single `uploader` prop (registry, write-back,
toolbar picker, drop-a-file-on-the-page, drop highlight), the media
accessibility badge, and the `tableEditing` plugin — the default schema
declared tables while the batteries tier never installed the plugin that makes
them behave.

New extension points, all additive: `uploader`, `toolbarExtras` (app controls
rendered inside the editor's providers), `slashMenuItems`, and `children`
(overlays over the canvas). The playground shrank from ~400 lines to ~130, all
of them genuinely application code — transport, file I/O, print, a debug
preview — and now *is* the top-tier integration it was meant to demonstrate.

One regression caught by the size gate and worth remembering:
`defaultSlashItems` began life as an exported constant whose entries call
command factories at module top level. That is a side effect no bundler can
prove away, and it silently cost the primitives-only consumer bundle 25 KB of
editor code. It became a function for the same reason `mediaNodeSpecs()` is
one.

## Milestone 9.11 — The File menu: print and import/export become batteries

The third recurrence of the same drift closed the classification error behind
the first two. Print and file import/export had stayed in the playground under
CLAUDE.md's "storage is an application concern" — but their every ingredient
(`PrintExporter`, the default schema, renderers, parse spec, all importers and
exporters) is package-owned, and downloading a file or printing is a *browser*
interaction like copy and paste, touching no storage, credentials or network.
Misfiled, not out of scope.

`FileMenu` now ships in `<DocsEditor />`'s toolbar (leading, so it can never
overflow): Import…, Export as Markdown / HTML / JSON / DOCX, Print. Markdown
and DOCX load dynamically on the click that needs them — DOCX alone is ~262 KB
a session that never exports one should never download. Importing replaces the
open document through an internal session remount and fires `onChange`, and is
withheld in read-only mode. `fileMenu={false}` opts out.

The playground is now its intended final form: **`<DocsEditor
initialDocument={…} uploader={mockUploader} />`** and nothing else — 112 lines
across all of `src/`, 37 of them the mock uploader, the one thing an editor
cannot invent (a real application's endpoint). Its stylesheet is the package
import, `body { height/margin }`, and one token override. The import/export
panel and the debug tree view were deleted; the six e2e/perf specs that used
the panel as a bulk-load mechanism now drive the shipped Import flow through a
real file chooser.

## Milestones 9.12–9.14 — Polish and two field bugs

**9.12 — visual polish.** The primitives were standardised functionally in 9.5
and left visually flat. Now: real hover tokens (`--de-primary-hover`,
`--de-destructive-hover`) replacing the `opacity: 0.9` hack — transparency
over an unknown backdrop is a colour the contrast tests cannot compute — a
dedicated `--de-tooltip` pair (tooltips had borrowed the primary button's
colours, welding two unrelated theming decisions together), one motion grammar
for every button, menu and tooltip entrances under `prefers-reduced-motion`
guards, a drawn checkmark, a rotating select chevron, and a uniform
`:focus-visible` ring. The find bar and colour pickers were the last controls
without styled tooltips; the new token pairs are contrast-gated like all
others, including hover states.

**9.13 — media drag duplicated the node.** The schema had no `draggable`
field, so the browser ran its *native* image drag; the engine never learned
the drag was a move and handled the drop as a paste of the drag's HTML — copy
inserted, source kept. `NodeSpec.draggable` now exists, compiles through, and
every media type (and `figure`) declares it: dragging moves, Ctrl-drop copies.

**9.14 — the page snapped back and forth near the bottom margin.** Two
compounding faults. The page-break spacer was inline `margin-top`, which
*overwrote* the stylesheet's own margin-top block rhythm (0.75em on a
paragraph, 1.6em on a heading) — so the applied spacing was short by a
per-block-type amount the natural-position recovery never saw, and any block
within that error of a boundary flip-flopped between pages on every pass. And
the engine silently drops a node decoration whose positions have drifted off a
node boundary, which every stored decoration has in the frames between a
keystroke and re-measure — the spacing blinked off and on per keystroke.
Fixes: spacers are `padding-top` (purely additive; collapses with nothing;
overrides nothing; the arithmetic accounts for padding growing the block
rather than moving it), and drifted node decorations snap to their enclosing
top-level block instead of vanishing. An e2e test types at a live page
boundary and asserts the laid-out height never oscillates.

## Milestone 9.8 — Documentation, budgets, verification

Bundle budgets are raised deliberately here with the reason recorded, rather
than left for CI to discover. A phase this size that did not move them would be
the surprising outcome.

Exit Criteria:

- Alignment, indent/outdent, font size, task lists, list styles and clear
  formatting all work from both the toolbar and the keyboard
- Insert Link opens a real editor and round-trips an existing link's target;
  `javascript:` cannot reach exported markup
- Blocks and media reorder by drag, and by keyboard
- Checkboxes, dropdowns, tooltips and buttons are consistent in light and dark
- Every icon-only control has a tooltip; no control is a bare text button
  without reason
- All packages build, lint, typecheck and test clean; e2e green; budgets met

Target Version:

v0.10.0

---

# Phase 9.5 — Embedding & Composition

Status:

Complete

Objective:

Make `<DocsEditor />` a component an application can *embed* — sized by its
container, composed control by control, and themed from outside — rather than
one an application has to submit to.

## The gap, reported

Phases 8 and 9 optimised for "install and plug in", and the first integration
outside this repository showed what that had cost. To place the editor inside
an existing application shell, the integrator wrote:

```css
.de-shell {
  display: grid !important;
  height: 88.5dvh !important;
  grid-template-rows: auto 1fr auto !important;
  overflow: hidden !important;
}
```

A consumer overriding our internal class names with `!important`, and guessing
a viewport fraction, is not a styling preference — it is the only exit from a
component that had decided its own size. Three faults, one theme:

1. **The shell hard-coded `100dvh`.** Correct for an editor that *is* the page;
   wrong inside a flex column, a pane, a tab or a dialog. `className` landed on
   the theme wrapper, which could not override the shell inside it, so
   `!important` was the only lever.
2. **The toolbar was all-or-nothing.** Wanting the default bar *minus the font
   picker* meant replacing the whole bar and reimplementing the rest.
3. **The colour scheme could only be seeded.** `colorScheme` set the starting
   value and was then owned by the editor, so an application with its own
   light/dark switch could not drive it.

## Milestone 9.5.1 — Layout is the application's

`EditorShell` and `DocsEditor` take `height: "parent" | "viewport" | "auto"`,
defaulting to `"parent"`: the editor fills the element it is rendered into and
forces no size of its own. The theme wrapper became a layout pass-through so
the size reaches the shell, and `className`/`style` land on it.

## Milestone 9.5.2 — The toolbar is a roster

Every control has a stable id. `toolbarItems` states the roster and its order,
`hiddenToolbarItems` subtracts from it, and `slots.toolbarItem` supplies
content per id — replacing a built-in or defining one of the application's own.
Ids are data, so all three survive being read from configuration or a
permission check.

## Milestone 9.5.3 — Slots in every region

`DocsEditorSlots` names every place an application can put its own content:
header, footer, toolbar start/end and per item, sidebar start/end, status bar
start/end, above/below the document, and over the canvas. Slots render inside
the editor's providers, so `useEditor()` works in them. `EditorShell` grew
`header` and `footer` regions to match.

## Milestone 9.5.4 — The colour scheme is controllable

`colorScheme` is now **controlled** and pairs with `onColorSchemeChange`;
`defaultColorScheme` seeds an uncontrolled editor. `applyColorSchemeToDocument`
makes writing to `<html>` opt-in and defaults to off — an embedded editor must
not restyle the page around it.

## Milestone 9.5.5 — A desk gutter that answers to the canvas

Width needed no prop: a block element already inherits its parent's width, which
is precisely the asymmetry that made height the awkward axis. What it needed was
for the space *around* the page to stop being fixed.

The gutter between the sheet and the edge of the canvas is now two tokens
(`--de-canvas-padding-block`, `--de-canvas-padding-inline`) stepped down by a
**container** query on the canvas. The rule it replaced was a viewport media
query, which asks the wrong question once the editor is embeddable: a 500px
editor in a pane on a 1920px monitor kept a full desktop margin, while a
full-screen editor on a tablet lost it. Reclaiming the gutter also keeps an A4
sheet fitting a little longer before it has to scroll.

Below roughly 830px the sheet genuinely does not fit, and something has to give.
There were two honest answers, and the difference between them is where the
overflow lives:

1. Let the sheet hang outside the canvas and scroll the **canvas**.
2. Clamp a **scrollport** to the canvas and scroll the sheet inside it.

The first was built and rejected. It let the page cross the gutter it is
supposed to sit inside — the sheet slid under the sidebar and off the edge of
the editor — and centring an overflowing item put the document's left margin
where no scroll offset could reach it, since offsets do not go negative.

So `PageSurface` now renders a scrollport around the sheet: the sheet's own
width, clamped to `max-width: 100%` of the desk's content box, with
`overflow-x: auto`. **The page never extends past the canvas or its gutter, and
the overflow is scrolled within the page's own footprint.** The clamp is inline
rather than in the stylesheet, following this component's existing rule that
computed structural sizing must not be themeable away. A `pageViewport` theme
slot carries the class.

The sheet keeps its true width throughout: it is the scrollport that clamps,
never the paper. A paged editor whose page reflowed to the window would no
longer be showing the document that will print.

The accepted cost is that a document-tall scrollport puts its horizontal
scrollbar at the bottom of the page rather than pinned to the viewport;
trackpad and shift+wheel reach it anywhere over the page.

## Breaking changes

Three, all in `@sbh321/docs-editor`, all justified by the above and documented
with migrations in the package README and the changeset:

- `DocsEditor`/`EditorShell` no longer fill the viewport by default —
  `height="viewport"` restores it.
- `DocsEditor`'s `colorScheme` is controlled — `defaultColorScheme` is the old
  behaviour.
- `EditorToolbar`'s `items` is the roster; insert-menu entries moved to
  `insertMenuItems`, and `colorSchemeToggle={false}` became
  `hide={["colorScheme"]}`.

Exit Criteria:

- The editor sizes itself from its container, with no `!important` needed
- Every toolbar control can be hidden, reordered or replaced by id
- Every region of the shell accepts application content by slot
- Light/dark can be driven from outside the editor
- All packages build, lint, typecheck and test clean; e2e green

Target Version:

v0.2.0

---

# Phase 10 — Version History

Status:

Planned

Objective:

Introduce document history beyond basic undo/redo.

Deliverables:

- Snapshot engine
- Snapshot metadata
- Named versions
- Restore functionality
- History browser
- Version API

Future:

- Automatic save checkpoints

Exit Criteria:

- Documents maintain recoverable version history
- Public history API finalized

Target Version:

v0.11.0

---

# Phase 11 — Visual Diff Engine

Status:

Planned

Objective:

Provide Git-inspired document comparison.

Deliverables:

- Snapshot comparison
- Block-level diff
- Inline text diff
- Added/Removed highlighting
- Change metadata
- Diff API

Future:

- Merge support

Exit Criteria:

- Users can visually compare document versions
- Diff engine performant on large documents

Target Version:

v0.12.0

---

# Phase 12 — Plugin Architecture

Status:

Planned

Objective:

Expand editor capabilities without modifying the core.

Initial Plugins:

- Mathematics
- Mermaid diagrams
- Footnotes
- Citations
- References
- Timeline
- Embed providers (oEmbed resolution for YouTube, Vimeo, X, …)

Note: generic media — images, video, audio, file attachments and the `embed`
node itself — is core, delivered in **Phase 7 — Media**. What remains a plugin
is *provider resolution*: turning a third-party URL into a rich embed, which
means network access and provider-specific knowledge that the core has no
business carrying.

Exit Criteria:

- Public plugin API stable
- Third-party plugins supported

Target Version:

v0.13.0

---

# Phase 13 — Framework Expansion

Status:

Future

Objective:

Support additional frontend ecosystems.

Packages:

- @sbh321/docs-editor-vue
- @sbh321/docs-editor-angular
- @sbh321/docs-editor-svelte

Exit Criteria:

- Shared core
- Thin adapters
- Consistent APIs

Target Version:

v0.14.0

---

# Phase 14 — Stable Release

Status:

Future

Objective:

Prepare for long-term public adoption.

Deliverables:

- Stable API
- Complete documentation
- Migration guides
- Accessibility audit
- Performance audit
- Security audit
- Production examples

Exit Criteria:

- API freeze
- Documentation complete
- Test coverage target achieved
- Community-ready release

Target Version:

v1.0.0

---

# Future Exploration

Potential future capabilities:

- Track changes
- Comments
- Real-time collaboration
- CRDT integration
- Mobile optimization
- AI-assisted editing
- Offline synchronization
- Collaborative cursors
- Multi-document workspaces

These features are intentionally excluded from the initial roadmap and should only be considered after the core editor reaches long-term stability.

---

# Guiding Principles

Every milestone should:

- Improve architecture
- Preserve maintainability
- Expand extensibility
- Increase test coverage
- Maintain performance
- Keep the public API clean

Feature completeness is secondary to engineering quality.

Docs Editor should evolve through deliberate, well-tested iterations rather than rapid accumulation of features.