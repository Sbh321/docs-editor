# @sbh321/docs-editor-react

Thin React adapter for [Docs Editor](../../README.md), built on top of
[@sbh321/docs-editor-core](../docs-editor-core).

> **Status:** [Phase 4 — User Interface](../../docs/ROADMAP.md#phase-4--user-interface)
> complete. Builds on the Phase 2 adapter (`EditorProvider` + hooks, real
> `contentEditable` `<Editor />`, `nodeRenderers`/`markRenderers`, `keymap`)
> with a full **headless UI layer**: `Toolbar`, `FloatingToolbar`,
> `SlashMenu`, `ContextMenu`, `OutlinePanel`, `TableOfContents`,
> `ZoomControls`, a headless `ThemeProvider`, and the query/command hooks that
> drive them. Every component is unstyled behavior only — styling and icons
> stay optional (see [Headless UI](#headless-ui)).

## Package boundary

This package provides React integration — the Editor component, hooks,
context, providers, and (as of Phase 4) the headless UI components. It must
never duplicate editor logic that belongs in `@sbh321/docs-editor-core`: every
component here is *presentation and interaction only* and delegates all
behavior to core commands and queries (`toggleMark`, `isMarkActive`,
`getOutline`, …). See
[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#package-boundaries) for the
full boundary rules.

## Usage

```tsx
import { createSchema, EditorState } from "@sbh321/docs-editor-core";
import { Editor, EditorProvider, useEditor } from "@sbh321/docs-editor-react";

const schema = createSchema({
  topNode: "doc",
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline", isText: true },
  },
});

const doc = schema.createDocument([
  schema.node("paragraph", undefined, [schema.text("Hello")]),
]);
const initialState = EditorState.create({ schema, doc, selection: { anchor: 1, head: 1 } });

function Toolbar() {
  const { state, dispatch } = useEditor();
  return (
    <button onClick={() => dispatch(state.tr.insertText("!"))}>
      Insert
    </button>
  );
}

export function App() {
  return (
    <EditorProvider initialState={initialState}>
      <Toolbar />
      <Editor nodeRenderers={{ paragraph: () => ["p", 0] }} />
    </EditorProvider>
  );
}
```

## API

- **`EditorProvider`** — owns an `EditorState` (via `useReducer`, reducer =
  `state.apply(transaction)`) and makes it available to descendants. Accepts
  `initialState` (read once, on mount — later changes to the prop are
  ignored) and an optional `onStateChange` callback fired after every
  dispatched transaction.
- **`useEditorState<NodeName, MarkName>()`** — returns the current
  `EditorState`. Re-renders only components that call this hook when state
  changes.
- **`useEditorDispatch<NodeName>()`** — returns a stable `dispatch` function
  (identity never changes across renders, since it comes straight from
  `useReducer`). Components that only dispatch (e.g. toolbar buttons) can
  depend on just this hook and skip re-rendering on every state change.
- **`useEditor<NodeName, MarkName>()`** — convenience combining both hooks
  into `{ state, dispatch }`.
- **`<Editor className? editable? nodeRenderers? markRenderers? keymap? />`**
  — renders the current state to a real, editable DOM node. Must be inside
  an `EditorProvider`. Constructs a `docs-editor-core` `EditorView` on mount
  and destroys it on unmount; later state changes are synced via
  `view.updateState()`, not by reconstructing the view (which would drop DOM
  selection, IME composition state, and scroll position on every keystroke).
  Pass `editable={false}` for read-only rendering. `nodeRenderers`/
  `markRenderers`/`keymap` are read once, at mount, the same as `dispatch` —
  an inline object literal here won't force-remount the view on every
  render. `keymap` maps key-combo strings to `Command`s, e.g.
  `{ ...baseKeymap, "Mod-b": toggleMark("bold"), "Mod-z": undo }`. Spread
  `baseKeymap` (from `@sbh321/docs-editor-core`) to get the essential editing
  bindings — Enter splits, Backspace/Delete join — so the editor works out of
  the box; see that package's README for the key-string format.

All hooks throw a descriptive error if called outside an `EditorProvider`.

### Why two contexts

State and dispatch are split into separate React contexts specifically so
that dispatch-only consumers (toolbar buttons, keyboard shortcut handlers)
don't re-render on every document change — they can subscribe to
`useEditorDispatch()` alone, whose value is referentially stable.

### Rendering

`<Editor />` delegates entirely to `docs-editor-core`'s `EditorView`, which
wraps `prosemirror-view` — no ProseMirror type crosses into this package.
Any node/mark type without a `nodeRenderers`/`markRenderers` entry falls back
to a generic, unstyled element named after it (`<paragraph>`, `<bold>`) —
there's no principled way to decide "every paragraph renders as `<p>`"
globally, for every consumer, by default. (Phase 4's `ThemeProvider` is a
separate concern: it styles the *UI chrome* — toolbars, menus — not the
document's own node/mark rendering, which stays driven by these renderer maps.) A renderer is a `(node) => DOMOutputSpec` function returning a
small, JSON-safe DSL (tag name, optional attributes, children) — see
`@sbh321/docs-editor-core`'s README for the full shape.

## Headless UI

Phase 4 added an unstyled, accessible UI layer. Nothing here forces a look:
every component renders semantic, `role`-correct markup, takes a `className`
(and often a render prop), and reads *optional* theme class names/icons. With
no `ThemeProvider` and no CSS, everything still works — just unstyled.

### Query & command hooks

The seam between core's headless commands/queries and any control:

- **`useIsMarkActive(mark, attrs?)` / `useIsBlockActive(type, attrs?)`** —
  whether a mark/block is *currently applied* (a button's pressed state). This
  is distinct from a command dry run, which answers whether it *can* apply.
- **`useActiveMarks()` / `useActiveBlockType()`** — the raw active state.
- **`useCommand(command)`** → `{ run, enabled }` — bridges a core `Command` to
  a control: `enabled` from a dry run, `run` dispatches and refocuses the editor.
- **`useOutline(options?)`** — the document's heading structure.
- **`useEditorView()`** — the live `EditorView` (or `null`), published by
  `<Editor />`; used for caret coordinates and focus.
- **`useSearchHighlight(query, options?)`** / **`<SearchHighlight>`** —
  highlights every `findText` match of `query` (via the core decoration layer)
  and returns the matches for "find next" navigation; the active match gets an
  extra class. Headless — you style `docs-editor-search-match` /
  `-active` (or your own classes). **`useDecorations(decorations)`** is the
  generic overlay primitive underneath, for other decoration uses.

### Components

- **`Toolbar` / `ToolbarButton` / `ToolbarGroup` / `ToolbarSeparator`** — a
  `role="toolbar"` with roving-tabindex arrow-key navigation. `ToolbarButton`
  auto-wires `disabled`/`aria-pressed` from a `command` + `active`, and resolves
  an icon from `icon` or a theme `iconName`.
- **`FloatingToolbar`** — floats over a non-empty text selection, hides when it
  collapses. Positioned with [`@floating-ui/react`](https://floating-ui.com).
- **`SlashMenu`** — opens on a `/` trigger, filterable, keyboard-driven.
  Choosing an item removes the typed `/query` and then runs its command.
- **`ContextMenu` / `ContextMenuItem`** — a right-click menu at the pointer,
  focus-trapped, dismiss on Escape/outside.
- **`OutlinePanel` / `TableOfContents`** — jump-to navigation (flat / nested).
- **`ZoomProvider` / `useZoom` / `ZoomControls`** — zoom as transient UI state;
  `useZoom().editorStyle` spreads onto `<Editor style>`.
- **`PageLayoutProvider` / `usePageLayout` / `PageSetupControls` / `PageSurface`** —
  a page view: renders the editor on a correctly-sized sheet (size, orientation,
  margins, header/footer, page numbers), with page layout held as transient UI
  state (like zoom). `<PageSurface paginate>` turns on **live pagination**
  (`usePagination`) — content flows onto multiple sheets with gaps as it grows,
  recomputed on every content/layout/size change. The editor stays a single
  contenteditable: page breaks are visual node-decoration spacing (composed under
  a `"pagination"` decoration source so they coexist with search highlighting),
  never document edits. A block taller than a page overflows rather than
  splitting.
- **`ThemeProvider` / `useTheme`** — a headless theme contract of `classNames`
  (per slot), `icons` (by intent — accepts `@sbh321/docs-editor-icons`'
  `defaultIcons`), and `tokens` (emitted as CSS custom properties).

```tsx
import { Toolbar, ToolbarButton, ThemeProvider } from "@sbh321/docs-editor-react";
import { toggleMark } from "@sbh321/docs-editor-core";
import { defaultIcons } from "@sbh321/docs-editor-icons";

<ThemeProvider icons={defaultIcons} classNames={{ toolbarButton: "my-btn" }}>
  <Toolbar label="Formatting">
    <ToolbarButton command={toggleMark("bold")} active={useIsMarkActive("bold")} iconName="bold" label="Bold" />
  </Toolbar>
</ThemeProvider>;
```

## Media node views

`useMediaNodeViews()` returns interactive node views for the core's media types,
ready to pass to `<Editor nodeViews>`:

```tsx
function MyEditor() {
  const nodeViews = useMediaNodeViews();
  return <Editor nodeRenderers={nodeRenderers} nodeViews={nodeViews} />;
}
```

They are plain DOM rather than React: a node view's element is owned by the
editor, so rendering React into it would mean a portal per node and a second
reconciler racing the editor's own updates.

Media can be resized by dragging a corner — and, because a pointer gesture with
no keyboard equivalent is an accessibility regression, by keyboard:

| Key | Effect |
| --- | --- |
| `←` / `→` | Narrow / widen (`resizeStep`, default 16px) |
| `Shift` + `←` / `→` | Larger step (`coarseResizeMultiplier`, default 4×) |
| `Alt` + `←` / `→` | Align left / right |

Unmodified arrows are *not* swallowed when they do not resize, so the caret is
never trapped on a media node.

Each wrapper is focusable, exposes `role="group"`, and carries an `aria-label`
built from the node's description — falling back to `"image (no description)"`
so a missing description is announced rather than silent. Editing alt text
updates both that label and the element's own `alt` in place, without rebuilding
the element (which would re-fetch the image, or restart a video, on every
keystroke).

All editing behaviour delegates to core commands; this layer only handles
interaction.

## Scripts

- `pnpm build` — bundle with tsup (ESM only)
- `pnpm dev` — bundle in watch mode
- `pnpm test` — run unit tests with Vitest + Testing Library
- `pnpm typecheck` — `tsc --build` against the TypeScript project reference graph
- `pnpm lint` — ESLint
- `pnpm storybook` — run Storybook locally
- `pnpm build-storybook` — build the static Storybook site
