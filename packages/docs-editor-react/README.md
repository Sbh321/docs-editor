# @sbh321/docs-editor-react

Thin React adapter for [Docs Editor](../../README.md), built on top of
[@sbh321/docs-editor-core](../docs-editor-core).

> **Status:** [Phase 2 — React Adapter](../../docs/ROADMAP.md#phase-2--react-adapter)
> complete — state layer (`EditorProvider` + hooks), real `contentEditable`
> rendering (`<Editor />`), customizable per-node/mark rendering
> (`nodeRenderers`/`markRenderers`), and keyboard shortcuts (`keymap`), used
> across three apps (Vite playground, Vite example, Next.js example).
> There's still no theme system (see [Rendering](#rendering) below), so any
> type without a custom renderer falls back to a generic, unstyled default.

## Package boundary

This package provides React integration only — the Editor component, hooks,
context, and providers. It must never duplicate editor logic that belongs in
`@sbh321/docs-editor-core`. See
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
  `{ "Mod-b": toggleMark("bold"), "Mod-z": undo }` — see
  `@sbh321/docs-editor-core`'s README for the key-string format.

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
to a generic, unstyled element named after it (`<paragraph>`, `<bold>`),
since there's no theme system yet ([Phase
4](../../docs/ROADMAP.md#phase-4--user-interface)) and no principled way to
decide "every paragraph renders as `<p>`" globally, for every consumer, by
default. A renderer is a `(node) => DOMOutputSpec` function returning a
small, JSON-safe DSL (tag name, optional attributes, children) — see
`@sbh321/docs-editor-core`'s README for the full shape.

## Scripts

- `pnpm build` — bundle with tsup (ESM only)
- `pnpm dev` — bundle in watch mode
- `pnpm test` — run unit tests with Vitest + Testing Library
- `pnpm typecheck` — `tsc --build` against the TypeScript project reference graph
- `pnpm lint` — ESLint
- `pnpm storybook` — run Storybook locally
- `pnpm build-storybook` — build the static Storybook site
