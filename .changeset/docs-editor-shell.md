---
"@sbh321/docs-editor": minor
---

Add `EditorShell` and `<DocsEditor>` (Phase 8 — Batteries-Included Editor,
Milestone 8.5).

The target of the whole phase, reached:

```tsx
import { DocsEditor } from "@sbh321/docs-editor";
import "@sbh321/docs-editor/styles.css";

export default () => <DocsEditor />;
```

`<DocsEditor />` with no props at all is a working editor — the default preset,
the styled surfaces, and every provider the headless layer needs, assembled.
Props exist only for what is genuinely the application's business:
`initialDocument`, `onChange`, `schema`, `readOnly`, `pageLayout`, `paginate`,
`colorScheme`, `theme`, `onInsertImage`, and replacements for the toolbar,
sidebar and status bar.

`onChange` reports a plain `DocumentNode`, not an `EditorState` — an application
should not have to know what an editor state is to save its own document.

`EditorShell` is the frame on its own: a CSS grid filling the viewport with a
toolbar, an optional sidebar, a scrollable canvas and a status bar. It knows
nothing about editors, so a comment panel or a revision list fits it as readily
as an outline, and each region is a real landmark rather than an anonymous div.

**Filling the screen and the page metaphor are not in conflict.** The shell owns
the chrome and fills the window; the page sits centred inside the scrollable
canvas, still shaped like paper — which is what Word and Google Docs do.

The shell is `100dvh`, not `100vh`. On mobile browsers `vh` measures the
viewport *without* the collapsing address bar, so a `100vh` shell is taller than
the screen and its status bar sits permanently below the fold — the bar only
collapses on scroll, and the shell itself never scrolls.
