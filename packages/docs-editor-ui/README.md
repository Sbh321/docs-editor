# @sbh321/docs-editor

The batteries-included editor — [Docs Editor](../../README.md) assembled and
styled.

> **Status:** [Phase 8 — Batteries-Included Editor](../../docs/ROADMAP.md#phase-8--batteries-included-editor),
> complete.

## Why this package exists

The other packages are headless by design, which is what makes them composable —
and what made assembling an editor a ~1,800-line job. This is the assembled one.

Three layers, in descending order of control. Drop down whenever the one above
stops fitting:

| Need                          | Use                                    |
| ----------------------------- | -------------------------------------- |
| A working editor              | `<DocsEditor />`                       |
| Our chrome, your layout       | `EditorShell` + this package's surfaces |
| Your own design system        | `@sbh321/docs-editor-react` primitives |

## Quick start

```tsx
import { DocsEditor } from "@sbh321/docs-editor";
import "@sbh321/docs-editor/styles.css";

export default () => <DocsEditor />;
```

No props at all is a working editor: the default schema (with tables and their
editing plugin installed), a full toolbar, a **File menu** (import, export as
Markdown/HTML/JSON/DOCX, print — the heavy formats load lazily on the click
that needs them), a paginated A4 page, a status bar with word count and zoom, a
`/` command palette, Ctrl+F find and replace, a floating selection toolbar, a
page-layout panel behind a toolbar Layout button, drag-to-reorder with a
keyboard equivalent, checklists with clickable boxes, media, light and dark. If a feature of the editor needs code in *your*
application to exist at all, that is a bug — Phase 9's Milestone 9.10 exists
because it briefly happened.

Props exist only for what is genuinely yours:

```tsx
<DocsEditor
  initialDocument={doc}
  onChange={save}
  uploader={myUploader}
  toolbarExtras={<ShareButton />}
  readOnly={!canEdit}
/>
```

`onChange` hands you a plain `DocumentNode` — you should not have to know what
an `EditorState` is to save your own document. `initialDocument` is read once on
mount; loading a different document means remounting, which is what a `key` is
for.

### Uploads: you bring the transport, nothing else

```ts
const myUploader: MediaUploader = {
  async upload({ file, signal }) {
    const response = await fetch("/api/upload", { method: "POST", body: file, signal });
    return { url: (await response.json()).url };
  },
};
```

That is the whole integration. Given an `uploader`, the editor supplies the
toolbar picker, drop-a-file-on-the-page with a highlight, pending placeholders,
progress, retry, and writing the finished URL back into the document. Omit it
and no upload affordances render — an upload control the editor cannot complete
would swallow files.

Credentials, endpoints and CORS stay in your `upload` function, which is the
scope line CLAUDE.md draws: the editor defines the contract and drives the
lifecycle, and never performs a network request itself.

### The other extension points

- **`toolbarExtras`** — your controls, appended to the default toolbar *inside*
  the editor's providers, so `useEditor()` works in them. The playground's
  import/export panel and print button arrive this way.
- **`slashMenuItems`** — replaces the `/` palette's default items
  (`defaultSlashItems()`; everything the default schema can insert or become).
- **`sidebar`** — replaces the layout panel. A custom sidebar renders
  always-open, since the editor cannot know what to call a toggle for content
  it does not recognise; `null` removes the sidebar entirely.
- **`children`** — rendered over the canvas, for an application's own overlays.
- **`fileMenu={false}`** — removes the File menu. Importing replaces the open
  document and fires `onChange`; Import is withheld in read-only mode.

### The shell

`EditorShell` is the frame on its own — a CSS grid filling the viewport with a
toolbar, an optional sidebar, a scrollable canvas and a status bar. It knows
nothing about editors, so a comment panel or a revision list fits it as readily
as an outline.

Filling the screen and the page metaphor are not in conflict: the **shell** owns
the chrome and fills the window, while the **page** sits centred inside the
scrollable canvas, still shaped like paper. That is what Word and Google Docs
do.

It is sized in `100dvh`, not `100vh`. On mobile browsers `vh` measures the
viewport *without* the collapsing address bar, so a `100vh` shell is taller than
the screen and its status bar sits permanently below the fold — the bar only
collapses on scroll, and the shell itself never scrolls.

Opinions live here; **behaviour does not**. Every control delegates to a core
command, exactly as the headless UI layer does.

## Styling

```ts
import "@sbh321/docs-editor/styles.css";
```

Plain CSS with custom properties — no Tailwind, no PostCSS plugin, no build
configuration. A framework preset would make every consumer configure a build
step before they had an editor, and CLAUDE.md forbids coupling the editor to
one.

### Retheming

Override tokens anywhere the cascade reaches the editor:

```css
:root {
  --de-accent: #7c3aed;
  --de-radius: 10px;
  --de-font-document: "Source Serif 4", Georgia, serif;
}
```

`DOCS_EDITOR_TOKENS` exports the full vocabulary, and a test asserts the
stylesheet and that list stay in agreement in both directions — a token can be
neither undocumented nor undefined.

Colours come in **pairs** named for their role rather than appearance
(`--de-muted` / `--de-muted-foreground`), so a dark scheme is a different set of
*values* rather than a different set of rules. That is what keeps light and dark
from drifting apart as components are added.

### Light and dark

Both work with no configuration. The system preference is the default, and an
explicit choice overrides it **in both directions** — "follow my system" and
"give me dark even though my OS is light" are both things people want, and
supporting only the first is the usual bug.

```tsx
import { ThemeProvider, useColorScheme } from "@sbh321/docs-editor-react";

<ThemeProvider defaultColorScheme="system" applyToDocument>
  <MyEditor />
</ThemeProvider>;
```

```tsx
const { scheme, preference, toggle } = useColorScheme();

<button onClick={toggle} disabled={!toggle}>
  {preference === "system" ? `Auto (${scheme})` : preference}
</button>;
```

`applyToDocument` also sets the scheme on `<html>`. Off by default, since a
provider wrapping part of a page should not restyle the whole document — turn it
on when the editor *is* the page, so the body background matches and overscroll
does not reveal a white gap behind a dark editor.

### Contrast

Every text pair meets **WCAG AA (4.5:1)** and every control boundary meets the
non-text minimum (3:1), in both schemes. That is verified by parsing the shipped
stylesheet rather than a copy of its values, because a duplicated palette passes
forever while the real CSS drifts.

Two consequences worth knowing, since they make this palette look slightly
heavier than a purely aesthetic one:

- `--de-muted-foreground` is darker than the usual neutral-500. Secondary text
  is still text, and the lighter value read at 4.35:1.
- `--de-border-strong` is genuinely visible. A control's boundary is what
  identifies it, so it meets 3:1; `--de-border` stays light because it is
  decorative.

## Primitives

Button, Checkbox, Separator, Input, Select, Popover, DropdownMenu, Tooltip,
Dialog and ToolbarSurface. Every one takes a `className` that is **merged** with ours
rather than replacing it, so an override never means forking the component.

```tsx
import { Button, Popover, Input } from "@sbh321/docs-editor";

<Popover trigger={<Button icon={<PaletteIcon />} aria-label="Text colour" />} label="Text colour">
  {(close) => <Input label="Hex" onBlur={close} />}
</Popover>;
```

They cost **27.3 KB gzipped on their own** — importing them does not pull in the
editor, the core, or ProseMirror. An application that wants a themed dialog does
not download a document engine to get one.

### `Select` is a listbox, and what that cost

Until Phase 9 `Select` was a styled native `<select>`, on the reasoning that
native gets keyboard navigation, type-ahead, screen-reader support and the
mobile picker for free and gets them *right*. That reasoning was sound; the
trade stopped being worth it. A native select's **options cannot be styled**
across platforms, its popup ignores the page's dark theme almost everywhere,
and it cannot render a font name in its own face or a colour as a swatch —
which is exactly what a font picker, a size picker and a colour picker need.

So it is now an ARIA listbox, and everything native used to supply is ours:
arrow keys with wrap, Home/End, type-ahead, Enter/Space to commit, Escape to
close and restore focus, Tab to move on rather than trap. Focus stays on the
trigger and the active option is pointed at by `aria-activedescendant`, which
is what keeps type-ahead and Enter reaching the right element. Each of those is
tested directly, because they are the parts a hand-rolled listbox gets wrong.

`Checkbox` went the other way and stayed native: a real
`<input type="checkbox">`, visually hidden with the appearance painted by a
sibling. There was no styling reason to replace it — the box is a 16px square,
not a popup — so the browser keeps supplying activation, form participation and
announcement. `checked="mixed"` maps to the native `indeterminate` property,
which has no HTML attribute and can only be set imperatively.

### Button variants

`primary | secondary | outline | ghost | destructive`, a weight ladder rather
than a naming scheme. `secondary` was added in Phase 9 for a dialog with two
committing actions; `ghost` and `outline` already covered the two quietest
weights. Renaming the set to `primary`/`secondary`/`tertiary` was considered and
rejected — it would break every consumer to fix vocabulary, with no behaviour
gained.

### Behaviours that are not optional

These are the parts that are invisible when correct and broken when absent, so
they are built in rather than left to the caller:

- **`Button` defaults to `type="button"`.** Inside a form the HTML default is
  `submit`, which is almost never what a toolbar control wants and is a
  confusing bug to trace back to a missing attribute.
- **`aria-pressed` is omitted entirely** unless the button is a toggle.
  `aria-pressed="false"` on a plain button announces a toggle that happens to be
  off — a different control than the one rendered.
- **`Popover` and `DropdownMenu` move focus in and return it to the trigger.** A
  panel you can open but not get back out of strands a keyboard user.
- **`Dialog` traps focus and hides the page behind it.** A "dialog" without a
  trap is a box a keyboard user tabs straight out of and cannot find again.
- **A disabled menu item stays focusable** (`aria-disabled`, not `disabled`).
  Removing it from the tab order hides both the option and the fact that it is
  currently unavailable.
- **`Separator` is hidden from assistive technology by default.** A rule between
  toolbar groups is a visual grouping cue; announcing every one is noise.
- **`Input` marks invalid fields with `aria-invalid`**, because colour alone is
  not information a screen-reader user receives.
- **`Tooltip` forwards its props and ref to the trigger.** Without that, wrapping
  a dropdown's trigger in a tooltip absorbs the ref and click handler the
  dropdown clones onto it, and the menu silently never opens. That was a real
  regression when tooltips went across the toolbar in Phase 9.
- **A tooltip describes rather than renames.** It uses `aria-describedby`, so an
  icon-only button still needs its own `aria-label` — a tooltip that became the
  name would make a screen reader say everything twice.

## Editor surfaces

`EditorToolbar`, `FindBar`, `StatusBar`, `InsertMenu`, `OverflowRow`,
`UploadMediaButton`, `ZoomControls`, and the individual controls
(`BlockTypeSelect`, `FontFamilySelect`, `FontSizeControl`, `ColorControls`,
`TextFormatControls`, `AlignmentControls`, `ListControls`, `IndentControls`,
`LinkButton`, `ClearFormattingButton`, `LayoutButton`).

Alignment is a **dropdown**, not four toggles: choose-one-of-four is the shape a
menu expresses in one toolbar slot, and the trigger's glyph mirrors the
selection's current alignment. The row form existed first and cost three slots
of a toolbar that overflows at 1280px, pushing singular controls — Insert,
Layout, an application's own actions — into the overflow menu.

```tsx
import { EditorToolbar, StatusBar, editorTheme } from "@sbh321/docs-editor";
import { EditorProvider, ThemeProvider } from "@sbh321/docs-editor-react";

<ThemeProvider theme={editorTheme}>
  <EditorProvider initialState={state}>
    <EditorToolbar onInsertImage={pickFile} />
    …
    <StatusBar />
  </EditorProvider>
</ThemeProvider>;
```

`editorTheme` fills the headless layer's **slot** vocabulary — `"toolbar"`,
`"slashMenuOptionActive"`, `"pageCanvas"` and the rest. That is the extension
point Phase 4 built, so styling the headless components means filling slots
rather than wrapping or reimplementing them, and neither layer needs to know
about the other.

Every control delegates to a core command. A button's *disabled* state comes
from dry-running that command, so it can never disagree with whether the command
would actually do anything, and its *pressed* state is read from the document
rather than from a local flag.

### Toolbar overflow

Controls that do not fit move into an overflow menu, rather than wrapping onto a
second row (which pushes the document down) or running off the edge (where they
cannot be reached at all).

The obvious way to measure that is a hidden mirror of every control. It works,
but it puts a second copy of every control in the DOM — which breaks
`getByLabelText` in *your* tests, doubles the toolbar's render cost on every
keystroke, and depends on `aria-hidden` and `inert` to stay harmless. So
`OverflowRow` drops one item at a time and re-measures instead. It remembers the
width at which each item was removed and restores it only once the row is
genuinely wider than that, which is what stops it flickering at a boundary
width.

## Already using the headless primitives?

**Nothing breaks.** This package is additive: `@sbh321/docs-editor-core` and
`@sbh321/docs-editor-react` are unchanged, and an application built on them
keeps working without installing this one. The bundle budgets in
[docs/PERFORMANCE.md](../../docs/PERFORMANCE.md) record that the headless
scenarios did not grow.

Adopt it piecemeal if you want to:

| You have | You can take |
| --- | --- |
| Your own toolbar of `ToolbarButton`s | `editorTheme` — fills the slot vocabulary you already use |
| Your own layout | `EditorShell`, keeping your own toolbar and sidebar |
| Your own everything | nothing; carry on |

`editorTheme` is the cheapest step: the headless components already resolve a
class name per *slot*, so passing it to your existing `ThemeProvider` styles
them without changing a line of your markup.

Two things that moved in Phase 8 and are worth knowing about:

- **The default schema lives in `@sbh321/docs-editor-core/preset`**, not here —
  it is framework-agnostic data, usable from a server render or the Markdown and
  DOCX exporters. If you hand-wrote a schema matching the Docs Editor
  conventions, `defaultSchema` is very likely the same one.
- **`useMediaUploads` replaces hand-wiring uploads.** If you called
  `MediaUploadRegistry.start()` yourself, you also had to remember to call
  `applyMediaUploadResult` when it finished; forgetting leaves the node at an
  empty `src` forever while the upload reports success. The hook does both, and
  releases the upload afterwards.

## Scripts

- `pnpm build` — bundle with tsup (ESM only)
- `pnpm test` — run unit tests with Vitest
- `pnpm lint` / `pnpm typecheck`
