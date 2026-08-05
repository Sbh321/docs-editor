---
"@sbh321/docs-editor": minor
---

Add the composed editor surfaces (Phase 8 — Batteries-Included Editor,
Milestone 8.4).

`EditorToolbar`, `FindReplace`, `StatusBar`, `InsertMenu`, `OverflowRow` and the
individual controls, plus `editorTheme` — the theme object that fills the
headless layer's slot vocabulary (`"toolbar"`, `"slashMenuOptionActive"`,
`"pageCanvas"`, …). Styling the headless components means filling slots rather
than wrapping them, so neither layer needs to know about the other.

Every control delegates to a core command. A button's disabled state comes from
dry-running that command and its pressed state is read from the document, so
neither can disagree with what the editor would actually do.

**The toolbar now handles overflow.** Controls that do not fit move into an
overflow menu instead of wrapping onto a second row or running off the edge.
`OverflowRow` drops one item at a time and re-measures rather than keeping a
hidden mirror of every control — a duplicate tree breaks `getByLabelText` in a
consumer's tests and doubles the toolbar's render cost on every keystroke. It
remembers the width at which each item was removed and restores it only once the
row is genuinely wider, which is what stops it flickering at a boundary width.
