---
"@sbh321/docs-editor": minor
---

Make the editor embeddable: sized by its container, composed control by control,
and themed from outside (Phase 9.5 — Embedding & Composition).

The first integration outside this repository had to write this to place the
editor inside an application shell:

```css
.de-shell {
  height: 88.5dvh !important;
  grid-template-rows: auto 1fr auto !important;
}
```

A consumer overriding our internal class names with `!important` is not a
styling preference — it is the only exit from a component that had decided its
own size. Three defaults turned out to be decisions the *application* should
make, and all three are now props.

## Sizing

`DocsEditor` and `EditorShell` take `height`:

| `height` | Behaviour |
| --- | --- |
| `"parent"` *(default)* | Fills its container; the canvas scrolls |
| `"viewport"` | `100dvh` — for an editor that *is* the page |
| `"auto"` | Grows with the document; the surrounding page scrolls |

`className` and `style` land on the editor's outer element, which is now a
layout pass-through rather than a block that swallowed the height it was given.
No `!important` should ever be necessary.

```tsx
<div className="flex h-full min-h-0 flex-col">
  <DocsEditor className="flex-1" />
</div>
```

## Every toolbar control is addressable

Each control has a stable id (`DEFAULT_TOOLBAR_ITEMS` is the roster).
`toolbarItems` states the roster and its order, `hiddenToolbarItems` subtracts,
and `slots.toolbarItem` supplies content per id — replacing a built-in or
defining one of your own.

```tsx
<DocsEditor
  hiddenToolbarItems={["fontFamily", "colorScheme"]}
  toolbarItems={["file", "history", "share", "textFormat"]}
  slots={{ toolbarItem: { share: <ShareButton /> } }}
/>
```

Ids are data, so a roster can come from configuration or a permission check.

## Slots in every region

`slots` names every place an application can put its own content — `header`,
`footer`, `toolbarStart`/`toolbarEnd`, `toolbarItem`, `sidebarStart`/
`sidebarEnd`, `statusBarStart`/`statusBarEnd`, `aboveDocument`/`belowDocument`
and `canvasOverlay`. Each renders inside the editor's providers, so
`useEditor()` works in them. `EditorShell` grew matching `header` and `footer`
regions.

## Light and dark from outside

`colorScheme` is controlled and pairs with `onColorSchemeChange`, so one
application-level switch drives the editor too. `defaultColorScheme` seeds an
uncontrolled editor. `applyColorSchemeToDocument` makes writing to `<html>`
opt-in.

## Breaking changes

**1. The editor no longer fills the viewport by default.**

```diff
- <DocsEditor />
+ <DocsEditor height="viewport" />
```

Delete any rules that overrode `de-` classes to place the editor.

**2. `colorScheme` is controlled**, where it used to seed the scheme and hand
ownership to the editor.

```diff
- <DocsEditor colorScheme="dark" />
+ <DocsEditor defaultColorScheme="dark" />
```

`applyColorSchemeToDocument` also defaults to `false` — an embedded editor must
not restyle the page around it.

**3. `EditorToolbar`'s `items` is the toolbar roster.** Insert-menu entries
moved to `insertMenuItems`, and `colorSchemeToggle` became an id to hide. Both
are type errors rather than silent behaviour changes, and `<DocsEditor />` never
exposed either.

```diff
- <EditorToolbar items={insertEntries} colorSchemeToggle={false} />
+ <EditorToolbar insertMenuItems={insertEntries} hide={["colorScheme"]} />
```

## A desk gutter that answers to the canvas

Width needed no prop — a block element already inherits its parent's width. What
it needed was for the space *around* the page to stop being fixed. The gutter is
now two overridable tokens (`--de-canvas-padding-block`,
`--de-canvas-padding-inline`) stepped down by a **container** query on the
canvas: `1rem` → `0.5rem` at 900px → `0` at 600px.

The viewport media query it replaces asked the wrong question once the editor is
embeddable — a 500px editor in a pane on a 1920px monitor kept a full desktop
margin, while a full-screen editor on a tablet lost it.

Below ~830px an A4 sheet no longer fits, and two things now hold at once:

- **The page never extends past the canvas or its gutter.** `PageSurface`
  renders a scrollport around the sheet — the sheet's own width, clamped to
  `max-width: 100%` of the desk's content box — so the page cannot hang off the
  side of the editor or slide under the sidebar. A `pageViewport` theme slot
  carries its class.
- **The sheet keeps its true width and scrolls inside that footprint.** The
  overflow belongs to the page, not the canvas; nothing above the page moves
  sideways.

The page does not *reflow* to fit: what is clamped is the scrollport, never the
paper. A paged editor whose page changes width is no longer showing the document
that will print.

## Also

- The narrow-screen sidebar overlay is placed in the canvas' grid cell instead
  of being absolutely positioned from `--de-toolbar-height`, which was wrong the
  moment anything sat above the toolbar.
- New exports: `ColorSchemeToggle`, `HistoryControls`, `BlockTypeControls`,
  `FontFamilyControls`, `DEFAULT_TOOLBAR_ITEMS`, `resolveToolbarItems`, and the
  `ToolbarItemId`, `ToolbarItemName`, `ToolbarItemSlots`, `DocsEditorSlots` and
  `EditorShellHeight` types.
- `StatusBar` takes `leading`.
