# @sbh321/docs-editor-core

Framework-agnostic document editing engine for [Docs Editor](../../README.md).

> **Status:** [Phase 1 — Editor Core](../../docs/ROADMAP.md#phase-1--editor-core)
> — all four exit criteria are met — [Phase 3 — Rich Editing](../../docs/ROADMAP.md#phase-3--rich-editing)
> complete (headings, lists, quotes, dividers, code blocks, images, links,
> captions, tables, keyboard shortcuts, copy/paste, search & replace), and
> [Phase 5 — Import & Export](../../docs/ROADMAP.md#phase-5--import--export)
> complete (serialization contracts + registry, JSON/HTML/print exporters,
> sanitized HTML import; Markdown lives in `@sbh321/docs-editor-markdown`).
> Document model, schema system (`src/schema/`), internal ProseMirror-backed
> engine adapter (`src/engine/`), `EditorState`/`Transaction` (`src/state/`),
> commands (`src/commands/`), undo/redo history, JSON/HTML/print serialization
> (`src/serialization/`), copy/paste (`src/clipboard/`), document search
> (`src/search/`), and DOM rendering (`src/view/`, added in
> [Phase 2, Milestone 2.2](../../docs/ROADMAP.md#phase-2--react-adapter)) are
> implemented; the plugin architecture and event system are deliberately not
> — both are large and underspecified with no concrete consumer yet (no
> plugins exist), so designing them now would mean guessing rather than
> building against a real need. See `docs/ROADMAP.md`'s Phase 1 notes.

## Package boundary

This package must never import React, Vue, or any UI framework. It owns the
document model, commands, transactions, history, serialization, and plugin
system. See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#package-boundaries)
for the full boundary rules.

## Schema

`createSchema()` builds a `Schema` from a set of node/mark specs and is the
only way to construct `DocumentNode`s and `Mark`s — every document that exists
is guaranteed to satisfy its schema's structural and attribute constraints.

```ts
import { createSchema } from "@sbh321/docs-editor-core";

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true, marks: "all" },
  },
  marks: {
    bold: {},
  },
});

const doc = schema.createDocument([
  schema.node("paragraph", undefined, [schema.text("Hello", [schema.mark("bold")])]),
]);
```

`content` expressions support sequencing and quantifiers (`paragraph+`,
`inline*`, `note?`) but not yet alternation/grouping (`(a | b)*`) — see the
docstring on `NodeSpec.content` for the current grammar. No built-in node
catalog (headings, lists, tables, ...) ships from this package yet; that's
[Phase 3 — Rich Editing](../../docs/ROADMAP.md#phase-3--rich-editing).

A few node shapes worth knowing when you build a schema against Phase 3's
node catalog:

- **Leaf nodes** — omit `content` entirely (not `content: ""`, just leave it
  off) for a node that can never have children, like a `divider` or `image`.
  ProseMirror renders it as a single, non-editable unit; insert one with
  `Transaction.insertNode()` (see [State](#state)).
- **`code: true`** — marks a node type as holding literal, unformatted text
  (a `code_block`), which changes how the engine treats `Enter` and clipboard
  serialization inside it. It doesn't rebind `Enter` on its own — pair it with
  the `newlineInCode`/`exitCode` commands on a keymap (see [Commands](#commands)
  and [View](#view)).
- **Generatable required positions** — a node type used in a *required*
  (non-`?`/`*`) content position must be constructible from its attribute
  defaults alone. For example, `figure: { content: "image caption?" }`
  requires `image`, so `image`'s `src` attr needs a `{ default: "" }` —
  ProseMirror's schema compiler rejects a required position filled by a type
  it can't build from defaults ("Only non-generatable nodes … in a required
  position"), surfaced when the schema is first compiled into the engine (on
  `EditorState.create()`).
- **Tables** — declare `tableRole` on the table/row/cell node types so the
  engine's table support recognizes them: a `"table"` (content `"table_row+"`)
  contains `"row"`s, each containing `"cell"`/`"header_cell"` nodes. Cells
  need `colspan`/`rowspan` attributes (and optionally `colwidth`), and should
  be `isolating` so edits stay within a cell. Because the content grammar has
  no alternation, express "a row holds cells or header cells" by giving both
  cell types a shared `group` and using that in the row's content (e.g. both
  declare `group: "tablecell"`, and `table_row` has `content: "tablecell+"`) —
  the matcher resolves group references. Enabling *interactive* table editing
  is a separate opt-in — `EditorState.create({ tables: true })` (see
  [State](#state)) — and the row/column/merge operations live in
  [Commands](#commands).

  ```ts
  const schema = createSchema({
    topNode: "doc",
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*" },
      table: { group: "block", content: "table_row+", tableRole: "table", isolating: true },
      table_row: { content: "tablecell+", tableRole: "row" },
      table_cell: {
        content: "block+",
        group: "tablecell",
        tableRole: "cell",
        isolating: true,
        attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
      },
      table_header: {
        content: "block+",
        group: "tablecell",
        tableRole: "header_cell",
        isolating: true,
        attrs: { colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } },
      },
      text: { group: "inline", isText: true, marks: "all" },
    },
  });
  ```

## Engine

`src/engine/` compiles a `Schema` into a real `prosemirror-model` schema and
converts `DocumentNode`/`Mark` to and from ProseMirror's own node
representation. This is entirely internal — nothing under `src/engine/` is
exported from the package, and an ESLint rule (`no-restricted-imports` in the
root `eslint.config.js`) fails the build if any other file in this package
imports a `prosemirror-*` package directly. Per `docs/ARCHITECTURE.md`, this
keeps a future engine swap a contained internal change rather than a breaking
change for every consumer.

One real constraint this imposes on schemas: the node type with
`isText: true` must be named `"text"`, since ProseMirror determines
text-node-ness structurally from that exact name. `compileEngineSchema()`
throws an `EngineSchemaError` with an actionable message if this isn't met.

Another subtlety worth knowing if you're reading this code: docs-editor's
`NodeSpec.marks` is declared on the node that *carries* a mark (e.g.
`text: { marks: "all" }`), checked by `Schema.text()`/`Schema.node()` when
that specific node is constructed. ProseMirror's own `NodeSpec.marks` is the
other way around — a constraint on a *container's* content, checked against
the parent when a mark is applied. `compileEngineSchema()` bridges this by
computing each container's ProseMirror marks constraint as the union of the
`marks` declared by every node type that can appear in its content. Getting
this backwards is exactly the kind of bug that fails silently — marks just
never apply, no error — so it's covered by dedicated tests in
`compile-schema.test.ts`.

`MarkSpec` also carries `inclusive?` and `excludes?`. Set `inclusive: false`
on a link so typing just past it isn't part of the link; set `excludes: "_"`
on an inline `code` mark so it can't combine with bold/italic/etc. (a mark
always excludes itself). Both are compiled straight through to ProseMirror.

`compileEngineSchema()` also gives every non-text node/mark a default,
placeholder `toDOM` — an element literally named after it (`<paragraph>`,
`<bold>`), required because `prosemirror-view` refuses to render a node type
that has neither `toDOM` nor a custom node view. It's visible in devtools and
trivially CSS-targetable, but deliberately unstyled: there's no theme system,
and no principled way to decide "a paragraph renders as `<p>`" globally. Any
node/mark type can override this default per-view via `EditorView`'s
`nodeRenderers`/`markRenderers` — see [View](#view) below.

## State

`EditorState` holds a document and selection; `apply()` always returns a new
state, leaving the original untouched. `Transaction` is the mutable builder
you use to describe an edit before applying it.

```ts
import { EditorState } from "@sbh321/docs-editor-core";

const doc = schema.createDocument([schema.node("paragraph", undefined, [schema.text("Hello")])]);
const state = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

const next = state.apply(state.tr.insertText("Hi, "));
// state.doc is unchanged; next.doc reads "Hi, Hello" and the selection has
// been mapped forward automatically.
```

`Transaction` covers text, node, and mark edits plus selection —
`insertText`, `insertNode`, `delete`, `addMark`, `removeMark`,
`setSelection`, `selectNode`, `scrollIntoView`. `insertNode(node, from?, to?)`
replaces a range (or the current selection) with a single already-validated
node — the primitive behind inserting a leaf node like a divider:

```ts
const withDivider = state.apply(state.tr.insertNode(schema.node("divider")));
```

`selectNode(pos)` selects a whole node as a unit (a *node selection*, which
reads back as `{ type: "node" }`) — e.g. selecting an image or divider so it
can be deleted with `deleteSelection`. This is also what a live view produces
when you click an atomic node; `Selection` models three kinds now: `"text"`
(the default), `"node"`, and `"cell"` (table cells).

Commands that restructure the tree around *existing* content (wrap, lift,
split a list item, ...) live in `../commands` instead of adding their own
`Transaction` methods — see [Commands](#commands) below.

Pass `history: true` (or `{ depth, newGroupDelay }`) to `EditorState.create()`
to enable undo/redo tracking — it's opt-in, not automatic, matching
CLAUDE.md's "Explicit Over Implicit" and ProseMirror's own history plugin
being opt-in:

```ts
const state = EditorState.create({ schema, doc, history: true });
```

Pass `tables: true` (same opt-in shape) to enable interactive table editing —
rectangular cell selection by dragging or Shift-arrow, arrow-key navigation
across cells, and automatic repair of malformed tables. It's only meaningful
for a schema that declares table node types (see [Schema](#schema)), and it's
what makes the `type: "cell"` selection kind and the table commands work in a
live view. A schema with no tables should leave it off so it carries none of
that machinery:

```ts
const state = EditorState.create({ schema, doc, tables: true });
```

## Commands

A `Command` reports whether it applies in the current state and, only when
given a `dispatch` callback, performs its edit by calling `dispatch` with
the resulting transaction — calling a command with no `dispatch` is a dry
run, useful for deciding whether to enable a toolbar button without side
effects.

```ts
import { deleteSelection, toggleMark } from "@sbh321/docs-editor-core";

// Dry run: is there anything to delete right now?
const canDelete = deleteSelection(state);

// Actually apply it:
deleteSelection(state, (tr) => setState(state.apply(tr)));
toggleMark("bold")(state, (tr) => setState(state.apply(tr)));
```

`deleteSelection`, `selectAll`, `toggleMark`, `setMark` (set an
attribute-carrying mark to a value — e.g. a font family — replacing any existing
one, the "choose a value" counterpart to `toggleMark`), `setBlockType`,
`wrapIn`, `lift`, `newlineInCode`, `exitCode`, `removeFormatting`, and the essential
editing commands (`splitBlock`, `joinBackward`/`joinForward`, `joinUp`/
`joinDown`, `liftEmptyBlock`, `createParagraphNear`, `selectNodeBackward`/
`selectNodeForward`, `selectParentNode`) wrap
[`prosemirror-commands`](https://www.npmjs.com/package/prosemirror-commands)
(via `../engine`) rather than reimplementing "does this range already have
this mark" ourselves — the same encapsulation rule applies: nothing outside
`src/engine/` imports it directly.

### baseKeymap — a working editor out of the box

`baseKeymap` is a ready-made `Record<string, Command>` of the essential
bindings (Enter splits the block, Backspace/Delete join or delete across
boundaries, Mod-a selects all, Escape selects the parent). Spread it into a
view's `keymap` and the editor behaves like a text editor immediately; layer
your own bindings (and richer Enter handling for lists/code) on top:

```ts
import { baseKeymap, chainCommands, splitListItem, toggleMark } from "@sbh321/docs-editor-core";

const keymap = {
  ...baseKeymap,
  "Mod-b": toggleMark("bold"),
  // list/code handling first, then the base Enter chain
  Enter: chainCommands(newlineInCode, splitListItem("list_item"), baseKeymap.Enter),
};
```

`removeFormatting` clears every mark across the selection (the "clear
formatting" action), reporting `false` for an empty selection.

```ts
import { lift, setBlockType, wrapIn } from "@sbh321/docs-editor-core";

// Changes every textblock touched by the selection to "heading" with the
// given attrs (e.g. paragraph -> heading, or between heading levels).
setBlockType("heading", { level: 2 })(state, (tr) => setState(state.apply(tr)));

// Wraps the textblocks touched by the selection in a new "blockquote".
wrapIn("blockquote")(state, (tr) => setState(state.apply(tr)));

// Lifts the selected block (or its closest liftable ancestor) back out —
// the inverse of wrapIn, but not tied to any specific node type.
lift(state, (tr) => setState(state.apply(tr)));
```

`setBlockType`/`wrapIn` only change a node's own type/attrs or wrap it —
they don't otherwise restructure the tree. Both use `Schema.blockType(type,
attrs)`, which validates the type and defaults its attrs the same way
`Schema.mark()` does, without requiring content (unlike `Schema.node()`,
which always does).

```ts
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "@sbh321/docs-editor-core";

// Wraps the selected textblocks in a new "bullet_list"/"list_item".
wrapInList("bullet_list")(state, (tr) => setState(state.apply(tr)));

// The list-aware counterpart of pressing Enter/Tab/Shift-Tab inside a list
// item — bind these to a keymap (see View's "Keyboard shortcuts" below)
// rather than calling them directly; see the list_item name they take.
splitListItem("list_item");
sinkListItem("list_item"); // indent: nest into a sub-list
liftListItem("list_item"); // outdent, or lift out of the list entirely
```

`wrapInList`/`liftListItem`/`sinkListItem`/`splitListItem` wrap
[`prosemirror-schema-list`](https://www.npmjs.com/package/prosemirror-schema-list)
(via `../engine`) — list-specific structural edits that `prosemirror-commands`'
generic `wrapIn`/`lift` don't cover, since they need to know which node type
represents a list item. `wrapInList` uses `Schema.blockType()` like `wrapIn`;
the other three only need the type name (no attrs), so they pass it straight
to the engine layer, which validates it the same way.

The table commands — `addColumnBefore`, `addColumnAfter`, `deleteColumn`,
`addRowBefore`, `addRowAfter`, `deleteRow`, `mergeCells`, `splitCell`,
`toggleHeaderRow`, `toggleHeaderColumn`, `deleteTable` — wrap
[`prosemirror-tables`](https://www.npmjs.com/package/prosemirror-tables) (via
`../engine`). Unlike the list commands they take no node-type argument: the
table-editing plugin (enabled with `EditorState.create({ tables: true })`)
finds the current table and cell from the selection. Each reports `false`
without dispatching when the selection isn't in a table, so they compose in a
keymap and drive enabled/disabled toolbar buttons via a dry run.

```ts
import { addRowAfter, deleteTable, mergeCells } from "@sbh321/docs-editor-core";

addRowAfter(state, (tr) => setState(state.apply(tr)));
mergeCells(state, (tr) => setState(state.apply(tr))); // needs a multi-cell selection
deleteTable(state, (tr) => setState(state.apply(tr)));
```

There's **no `insertTable` command**: a table is an ordinary node built with
`Schema.node(...)` and inserted with `Transaction.insertNode(...)` — the same
primitive dividers and images use — so it needs none, mirroring how links
needed nothing beyond `toggleMark`.

```ts
const cell = (text) =>
  schema.node("table_cell", undefined, [schema.node("paragraph", undefined, [schema.text(text)])]);
const table = schema.node("table", undefined, [
  schema.node("table_row", undefined, [cell("A"), cell("B")]),
  schema.node("table_row", undefined, [cell("C"), cell("D")]),
]);
setState(state.apply(state.tr.insertNode(table)));
```

Merging cells needs a *rectangular cell selection* — the `{ ..., type:
"cell" }` selection kind. In a live view the table-editing plugin produces it
when the user drags across cells; programmatically, set one with
`tr.setSelection({ anchor: firstCellPos, head: lastCellPos, type: "cell" })`,
where the positions point *at* the two corner cells (each is the position
directly before a cell). See the `Selection` type's docstring for the full
contract.

`newlineInCode`/`exitCode` are the two commands for a `code: true` node (see
[Schema](#schema)). Both report `false` outside such a node, so they're meant
to be chained onto `Enter`/`Mod-Enter` on a keymap rather than called directly:

```ts
import { chainCommands, exitCode, newlineInCode, splitListItem } from "@sbh321/docs-editor-core";

// Inside a code block, Enter inserts a literal newline; anywhere else this
// falls through (newlineInCode reports false) to splitListItem, then to the
// browser default. Mod-Enter exits the code block into a new paragraph.
const enter = chainCommands(newlineInCode, splitListItem("list_item"));
```

`undo`/`redo` wrap [`prosemirror-history`](https://www.npmjs.com/package/prosemirror-history)
the same way. They report `false` — never throw — when there's nothing to
undo/redo, including when the state was created without `history` enabled:

```ts
import { redo, undo } from "@sbh321/docs-editor-core";

undo(state, (tr) => setState(state.apply(tr)));
redo(state, (tr) => setState(state.apply(tr)));
```

`chainCommands(...)` combines commands into one that tries each in order
and stops at the first that succeeds — the standard pattern for binding one
key to several candidate actions.

`CommandRegistry` looks commands up by name. It ships empty — nothing is
auto-registered, since which commands exist under which names is an
application/plugin decision:

```ts
import { CommandRegistry, deleteSelection } from "@sbh321/docs-editor-core";

const commands = new CommandRegistry();
commands.register("deleteSelection", deleteSelection);
commands.run("deleteSelection", state, dispatch);
```

## Serialization

`DocumentSerializer` is bound to one schema. `serialize()` is a thin,
documented wrapper (`DocumentNode` is already plain JSON-safe data); the
real work is in `deserialize()`, which rebuilds every node and mark through
`Schema.node()`/`.text()`/`.mark()` rather than trusting the input — so
untrusted or corrupted JSON is rejected with the same actionable errors
`Schema` already throws for hand-built data, instead of silently becoming a
malformed document.

```ts
import { DocumentSerializer } from "@sbh321/docs-editor-core";

const serializer = new DocumentSerializer(schema);
const json = serializer.serialize(doc);
const revived = serializer.deserialize(json); // or already-parsed data
```

### Format contracts, the registry, HTML, and print

[Phase 5](../../docs/ROADMAP.md#phase-5--import--export) adds symmetric
contracts so every format is expressed the same way and a new one is additive
(never a core change):

- `DocumentExporter<NodeName, Output = string>` — `{ format; serialize(doc): Output }`
- `DocumentImporter<NodeName, Input = string, Result = DocumentNode>` — `{ format; parse(input): Result }`

The payload type parameters default to `string`/`DocumentNode`, so text formats
and the synchronous registry are unchanged; binary/async formats parameterize
them — the DOCX package
([`@sbh321/docs-editor-docx`](../docs-editor-docx/README.md)) is a
`DocumentExporter<NodeName, Promise<Uint8Array>>` /
`DocumentImporter<NodeName, ArrayBuffer, Promise<DocumentNode>>` and is used
directly rather than through the string registry.

`SerializationRegistry` holds them keyed by `format` and exposes
`export(format, doc)` / `import(format, input)` (plus `has*`/`*Formats`),
rejecting duplicate or unknown formats with actionable errors — registration is
explicit, never automatic.

Shipped in core: `JsonExporter`/`JsonImporter` (exact round-trip),
`HtmlExporter`/`HtmlImporter`, and `PrintExporter`. **HTML import is sanitized**
— the input is loaded into an inert document, dangerous elements and
`on*`/`javascript:` attributes are stripped, and the result is rebuilt through
the schema, so arbitrary HTML is never executed. Import mapping is driven by an
`HtmlParseSpec` (tag → node/mark rules; a rule's `getAttrs` may return `null` to
decline the match — how the importer ignores, say, Google Docs' non-bold `<b>`
wrapper). `PrintExporter` wraps `HtmlExporter` to emit a standalone HTML
document with an embedded print stylesheet for `window.print()` (browser
print-to-PDF).

```ts
import {
  HtmlExporter,
  HtmlImporter,
  JsonExporter,
  JsonImporter,
  PrintExporter,
  SerializationRegistry,
} from "@sbh321/docs-editor-core";

const registry = new SerializationRegistry()
  .registerExporter(new JsonExporter(schema))
  .registerImporter(new JsonImporter(schema))
  .registerExporter(new HtmlExporter({ schema, nodeRenderers, markRenderers }))
  .registerImporter(new HtmlImporter({ schema, parseSpec }));

const html = registry.export("html", doc);
const doc2 = registry.import("html", html); // sanitized + schema-validated
const printable = new PrintExporter({ schema, nodeRenderers, markRenderers }).serialize(doc);
```

Markdown import/export lives in the separate
[`@sbh321/docs-editor-markdown`](../docs-editor-markdown/README.md) package — it
works over this public `DocumentNode` + `Schema` API, keeping the internal model
the single source of truth.

## Search

`findText(doc, query, options?)` returns every occurrence of `query` in a
document as `{ from, to }` ranges, in the same position scheme
`Transaction`/`EditorState` use — so a match can be handed straight to
`setSelection` or `insertText` with no conversion:

```ts
import { findText } from "@sbh321/docs-editor-core";

const matches = findText(state.doc, "hello"); // [{ from, to }, ...]

// "Find next" from the current cursor:
const cursor = selectionTo(state.selection);
const next = matches.find((match) => match.from >= cursor) ?? matches[0];
if (next) state.apply(state.tr.setSelection({ anchor: next.from, head: next.to }));

// "Replace" is just insertText over a match's range — there's no separate
// replace primitive, the same way links needed no command beyond toggleMark:
if (next) state.apply(state.tr.insertText("world", next.from, next.to));
```

Matching is case-insensitive by default; pass `{ caseSensitive: true }` to
require identical case. A match correctly spans adjacent inline nodes within
the same textblock (e.g. a bold mark splitting "World" into "Wor" + "ld"),
but never spans a block boundary — searching "bc" across a paragraph ending
in "ab" and one starting in "cd" finds nothing. This is intended search
behavior, not a limitation.

`findText` is pure and engine-agnostic: it walks the plain `DocumentNode`
tree with no `EditorState` or ProseMirror involved, so it can run anywhere a
document exists (a background index, a server, a test) — not only inside a
live editor. Visual highlighting of matches is a separate concern that needs
a decoration/overlay rendering layer this package doesn't have yet; `findText`
gives the positions, and today a consumer surfaces the current one by moving
the selection to it (as above).

## Queries

Active-state queries answer *"is this already applied here?"* — the pressed
state a toolbar needs, distinct from a command dry run (which answers *"can
this apply?"*, i.e. a button's `disabled` state):

```ts
import { isMarkActive, activeBlockType, isBlockActive } from "@sbh321/docs-editor-core";

isMarkActive(state, "bold"); // is bold active for the selection?
isMarkActive(state, "link", { href: "https://a.test" }); // ...with matching attrs?
activeBlockType(state); // { type: "heading", attrs: { level: 2 } }
isBlockActive(state, "heading", { level: 2 }); // true
```

At a collapsed cursor the active marks are the stored marks for the next typed
character; over a range, only marks covering the *entire* selection count (a
half-bold range reports bold inactive, matching what `toggleMark` would remove).
`activeMarks(state)` returns them all.

`getTextBefore(doc, pos)` returns the text of the current textblock up to a
position (empty across a block boundary) — pure like `findText`, intended for
trigger detection (e.g. a slash menu opening when the text before the cursor is
`"/"` plus a query).

## Outline

`getOutline(doc, options?)` returns each heading as `{ level, text, from, to }`
in document order — the data behind an outline panel or table of contents. It's
pure over the `DocumentNode` tree (no engine), like `findText`. Which node type
is a heading, and where its level lives, are explicit options (defaulting to
`"heading"`/`"level"`) since the core models no fixed schema:

```ts
import { getOutline } from "@sbh321/docs-editor-core";

getOutline(state.doc); // [{ level: 1, text: "Intro", from, to }, ...]
// `from + 1` is the first position inside a heading — place a cursor there:
state.apply(state.tr.setSelection({ anchor: entry.from + 1, head: entry.from + 1 }));
```

## Clipboard

`EditorState.copy(from?, to?)` returns a `ClipboardContent` — plain,
JSON-safe data holding the copied nodes plus `openStart`/`openEnd` (how many
levels are "unclosed" at each end, e.g. copying from mid-paragraph to
mid-paragraph). `Transaction.paste(content, from?, to?)` is the inverse,
rejoining those open boundaries with the surrounding content correctly
instead of nesting a partial paragraph inside another one. Both default to
the current selection when `from`/`to` are omitted:

```ts
import { EditorState } from "@sbh321/docs-editor-core";

const copied = state.copy(); // copies the current selection
const next = state.apply(state.tr.paste(copied, targetFrom, targetTo));
```

Internally this wraps ProseMirror's `Node.slice()`/`Slice` (via `../engine`,
same encapsulation rule as everywhere else) rather than reimplementing
partial-node boundary handling by hand.

There's no separate `cut`: it's `state.copy()` followed by
`state.tr.delete(...)`. A single `cut` primitive would need to hand the
copied content back to the caller *and* mutate the document in one step,
which doesn't fit a single command or transaction method — and writing to
the system clipboard is a DOM/application concern this headless package
never touches (see CLAUDE.md's Package Ownership: storage, routing, and
similar concerns belong to the consuming application, not the editor core).

## View

`EditorView` renders an `EditorState` to a real, editable DOM node and turns
typing/IME composition/paste/drag-and-drop back into `Transaction`s. It wraps
`prosemirror-view` entirely (`src/engine/prosemirror/view.ts`), the same
encapsulation rule as the rest of `src/engine/`.

```ts
import { EditorView } from "@sbh321/docs-editor-core";

const view = new EditorView(mountElement, {
  state,
  dispatchTransaction: (transaction) => {
    state = state.apply(transaction);
    view.updateState(state);
  },
});
```

This class only owns the DOM/input bridge — deciding when to construct,
update, and destroy one (component lifecycle) belongs to a framework adapter.
`@sbh321/docs-editor-react`'s `<Editor />` is a thin wrapper around exactly
this.

`view.coordsAtPos(pos)` returns the caret's viewport rectangle (`{ top,
bottom, left, right }`) at a document position — for anchoring floating UI (a
selection toolbar, a slash menu) built by a framework adapter. Pair it with
`Transaction.scrollIntoView()`, which flags a transaction so the view scrolls
the resulting selection into view when it dispatches (a no-op headless) — e.g.
after moving the cursor to a heading picked from an outline.

### Decorations

`view.setDecorations(decorations)` paints visual overlays on document ranges —
adding a class, style, or attribute — **without changing the document**. A
`Decoration` is plain data (`{ from, to, attributes }`) using the same position
scheme as everything else, so a `findText` match is directly usable:

```ts
import { findText } from "@sbh321/docs-editor-core";

const decorations = findText(state.doc, "hello").map((match) => ({
  from: match.from,
  to: match.to,
  attributes: { class: "search-match" }, // you supply the CSS
}));
view.setDecorations(decorations); // pass [] to clear
```

Decorations can be **inline** (default — wrap a text range) or **node**
(`type: "node"` — attribute a block's own element, e.g. a `margin-top` to push
it, the mechanism behind page-break spacing). Independent overlays **compose by
source** — each `setDecorations(decorations, source)` replaces only its own
source and the view renders the union, so pagination spacing and search
highlighting coexist instead of overwriting each other. `view.posAtDOM(node,
offset)` maps a rendered element back to a document position — used to turn a
measured block into the node decoration it needs.

## Page layout

The `page-layout` module is framework-agnostic page data — `PAGE_SIZES` (A4, A3,
A5, Letter, Legal, Tabloid, Executive), `PageOrientation`, `MARGIN_PRESETS`, the
`PageLayout` type, and `resolvePageDimensions()`/CSS helpers. Page layout is
*presentation* (how a document is displayed and printed), deliberately kept out
of the document model. `PrintExporter` accepts a `pageLayout` to emit an `@page`
size/margin rule and a running header/footer; the React adapter builds the
on-screen page view and live pagination on top of the same primitives.

Decorations are **view state, not document state** — they never touch a
`Transaction`, `EditorState`, or history, and deliberately don't flow through
the state/dispatch pipeline. Positions are resolved against the current
document on every render and clamped to its bounds, so the intended usage is to
*recompute and re-set* decorations whenever the document (or your source, like
a search query) changes — always correct, no position-mapping needed. This is
the overlay layer search-match highlighting needs (see the framework adapter's
`useSearchHighlight`), and the same primitive future comment ranges or
spellcheck squiggles would use.

Native OS clipboard copy/paste (Ctrl/Cmd-C, -X, -V) works through this view
with no extra code: `prosemirror-view` serializes the selection to the system
clipboard and parses it back using the compiled schema, and a same-document
round-trip preserves structure and marks (verified live in Chromium). The
programmatic [Clipboard](#clipboard) API below is the headless,
DOM-independent counterpart — for copy/paste outside a live view (tests,
server-side transforms). Importing *arbitrary external* HTML (pasted from
another application) faithfully needs per-node `parseDOM` rules the schema
doesn't model yet — that's
[Phase 5 — Import & Export](../../docs/ROADMAP.md#phase-5--import--export).

### Customizing rendering

`nodeRenderers`/`markRenderers` override the generic default for specific
node/mark types — the renderer map, decoupled from `Schema`, that Milestone
2.2 deliberately deferred:

```ts
const view = new EditorView(mountElement, {
  state,
  nodeRenderers: {
    paragraph: () => ["p", 0],
  },
  markRenderers: {
    link: (mark) => ["a", { href: String(mark.attrs.href) }, 0],
  },
});
```

A renderer is a `(node) => DOMOutputSpec` / `(mark) => DOMOutputSpec`
function — `DOMOutputSpec` is a small, JSON-safe, PM-independent DSL (own
type, not imported from `prosemirror-model`): a tag name string, an optional
attributes object, and children (nested specs, strings, or the number `0`, a
"hole" marking where the node's own content goes — required for a container
node/mark, and must be its only child). Types without an entry keep using
the generic default. Internally these are bridged to `prosemirror-view`'s
`nodeViews`/`markViews` (`src/engine/prosemirror/node-view.ts`) via
`DOMSerializer.renderSpec`, comparing re-rendered specs by value so ordinary
content edits reuse the existing DOM instead of tearing it down every
keystroke.

### Keyboard shortcuts

`keymap` binds key combinations to ordinary `Command`s:

```ts
import {
  chainCommands,
  exitCode,
  liftListItem,
  newlineInCode,
  redo,
  sinkListItem,
  splitListItem,
  toggleMark,
  undo,
} from "@sbh321/docs-editor-core";

const view = new EditorView(mountElement, {
  state,
  dispatchTransaction /* ... */,
  keymap: {
    "Mod-b": toggleMark("bold"),
    "Mod-z": undo,
    "Shift-Mod-z": redo,
    // A Command that reports `false` (e.g. Enter outside a code block or list)
    // falls through to the next command in a chain, then to the next binding
    // for that key, then the default browser behavior — so newlineInCode only
    // acts inside a code block and splitListItem only inside a list.
    Enter: chainCommands(newlineInCode, splitListItem("list_item")),
    "Mod-Enter": exitCode,
    Tab: sinkListItem("list_item"),
    "Shift-Tab": liftListItem("list_item"),
  },
});
```

Keys use `prosemirror-keymap`'s string format (`"Mod-"` resolves to Cmd on
Mac and Ctrl elsewhere; see [its docs](https://prosemirror.net/docs/ref/#keymap)
for the full syntax) — reused rather than reinvented, the same reasoning as
wrapping `prosemirror-commands` elsewhere: cross-platform modifier-key
handling is exactly the kind of well-tested edge case not worth re-solving.
Internally, `src/engine/prosemirror/view.ts` wires bindings to
`prosemirror-keymap`'s `keydownHandler()` (a plain function, not a Plugin —
this package never exposes ProseMirror's plugin system) as the view's
`handleKeyDown`. Each binding is re-wrapped so it can run against whatever
engine state the view currently holds when the key fires (not necessarily
the state this `EditorView` was constructed or last updated with) and
dispatched through the same `dispatchTransaction` path as typed input.

## Public API and `@internal`

Fields documented `@internal` (e.g. `EditorState`/`Transaction`'s `engine`
handle, read by `../commands` and `../view` to reach the engine adapter) are
real class fields, not truly private — `private` would block the
cross-module access this package's own layering needs. They're stripped from
the *published* `dist/index.d.ts` via `stripInternal` in `tsup.config.ts`'s
`dts.compilerOptions`, verified by grepping the built output for
`prosemirror` and confirming no import survives. This was a real,
previously-unnoticed gap: the `@internal` tags existed before this was ever
enabled, so ProseMirror's own types were leaking into the compiled public
API despite the "fully internal" intent — `stripInternal` only affects
declaration emission, not the package's own internal compilation, so nothing
inside the package needed to change.

## Scripts

- `pnpm build` — bundle with tsup (ESM only)
- `pnpm dev` — bundle in watch mode
- `pnpm test` — run unit tests with Vitest
- `pnpm typecheck` — `tsc --build` against the TypeScript project reference graph
- `pnpm lint` — ESLint
