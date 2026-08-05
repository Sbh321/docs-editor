---
"@sbh321/docs-editor": minor
---

Add the styled primitives (Phase 8 — Batteries-Included Editor, Milestone 8.3).

Button, Separator, Input, Select, Popover, DropdownMenu, Tooltip, Dialog and
ToolbarSurface, plus a `cn()` class-name helper. Every component merges the
caller's `className` with ours rather than replacing it, so adjusting one never
means forking it.

They cost **25.3 KB gzipped on their own** — importing them pulls in neither the
editor nor ProseMirror, so an application that wants a themed dialog does not
download a document engine to get one.

`Select` is a styled **native** `<select>`: keyboard navigation, type-ahead,
screen-reader support and the correct mobile picker come for free and come out
right, where a hand-rolled listbox has to re-implement all of it. The trade is
that option appearance is not fully stylable across browsers.

The behaviours that are invisible when correct are built in rather than left to
the caller: `Button` defaults to `type="button"` so it cannot accidentally
submit a form; `aria-pressed` is omitted unless the button really is a toggle;
`Popover` and `DropdownMenu` move focus in and return it to the trigger;
`Dialog` traps focus and hides the page behind it; a disabled menu item stays
focusable so it can still be discovered and announced.

No editing behaviour lives here — that stays in core commands.
