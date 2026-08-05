# @sbh321/docs-editor

## 0.1.0

### Minor Changes

- 9949369: Add `@sbh321/docs-editor` with its design tokens, and resolve light/dark out of
  the box (Phase 8 — Batteries-Included Editor, Milestone 8.2).

  **New package.** `@sbh321/docs-editor` is where the styled, assembled editor
  will live. It sits above `docs-editor-react` rather than inside it, so the
  headless packages stay headless: an application using the primitives with its
  own design system downloads none of this.

  ```ts
  import "@sbh321/docs-editor/styles.css";
  ```

  Plain CSS with custom properties — no Tailwind, no PostCSS plugin, no build
  configuration. Retheme by overriding tokens:

  ```css
  :root {
    --de-accent: #7c3aed;
    --de-radius: 10px;
  }
  ```

  Colours come in pairs named for their role rather than appearance (`--de-muted`
  / `--de-muted-foreground`), so a dark scheme is a different set of _values_
  rather than a different set of rules.

  **Light and dark work with no configuration.** The system preference is the
  default and an explicit choice overrides it **in both directions** — supporting
  only "follow the system" is the usual bug. `ThemeProvider` gains `colorScheme`,
  `defaultColorScheme`, `onColorSchemeChange` and `applyToDocument`, and the new
  `useColorScheme()` hook reports the resolved scheme with a light → dark → system
  toggle. It works without a provider too, falling back to reading the system
  directly.

  **Contrast is verified, not asserted.** Every text pair meets WCAG AA (4.5:1)
  and every control boundary meets 3:1, in both schemes — checked by parsing the
  shipped stylesheet rather than a copy of its values, so the test cannot pass
  while the real CSS drifts. Two colours are deliberately heavier than a purely
  aesthetic palette would pick: `--de-muted-foreground` (secondary text is still
  text, and the lighter value read at 4.35:1) and `--de-border-strong` (a control's
  boundary is what identifies it).

- 9949369: Add `EditorShell` and `<DocsEditor>` (Phase 8 — Batteries-Included Editor,
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
  viewport _without_ the collapsing address bar, so a `100vh` shell is taller than
  the screen and its status bar sits permanently below the fold — the bar only
  collapses on scroll, and the shell itself never scrolls.

- 9949369: Add the composed editor surfaces (Phase 8 — Batteries-Included Editor,
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

- 9949369: Add `useMediaUploads`, and complete the editor surfaces (Phase 8 —
  Batteries-Included Editor, Milestones 8.4 and 8.6).

  **`useMediaUploads(registry)`** connects a `MediaUploadRegistry` to the
  document. The registry never touches the document and the document never holds
  upload state — that separation is what keeps placeholders out of undo history —
  but something has to join them when an upload finishes, and leaving it to each
  application proved to be a reliable way to ship a broken editor: the node stays
  at the empty `src` it was inserted with and renders as a broken image forever,
  while the upload reports success. That bug was written twice in this repository
  before this hook existed.

  ```tsx
  const [registry] = useState(() => new MediaUploadRegistry({ uploader }));
  const uploads = useMediaUploads(registry);
  ```

  It also releases each upload once its result is in the document, and destroys
  the registry on unmount — an unreleased preview keeps its blob alive for the
  page's lifetime.

  **`TableControls` and `MediaControls`** complete Milestone 8.4. Both are
  contextual: they render nothing unless they apply, decided by dry-running a
  command rather than by re-implementing the rule. A row of permanently-disabled
  buttons trains people to stop looking at that part of the toolbar.
  `MediaAccessibilityBadge` surfaces the document's alt-text problems, which is
  what makes the gate visible while writing rather than at review.

  **The package now styles its own media node views.** `useMediaNodeViews` creates
  `.docs-editor-media` elements that previously had no dimensions of their own, so
  an image that failed to decode collapsed to nothing and could not be selected.

  **Zoom is now applied, not merely tracked.** `ZoomProvider` holds the factor and
  `ZoomControls` changes it, but _applying_ it is the consumer's job — and
  `<DocsEditor>` was not doing it, so the controls moved a number that scaled
  nothing.

- 9949369: Add the styled primitives (Phase 8 — Batteries-Included Editor, Milestone 8.3).

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

### Patch Changes

- 9949369: Document the batteries-included layer (Phase 8 — Batteries-Included Editor,
  Milestone 8.7).

  The root README now opens with the three-line quick start rather than a
  contributor guide, and adds a "which layer should I use?" table. PROJECT_SPEC
  and ARCHITECTURE record the new package, its boundary, and why it is separate
  from the React adapter. CLAUDE.md gains the package's responsibilities and the
  two dependency directions that must never appear
  (`docs-editor-react → docs-editor`, and any CSS framework).

  **"Headless first" is now a statement about layers**, not about the absence of a
  default — restated in both PROJECT_SPEC and ARCHITECTURE. A styled layer ships
  on top so the common case is one import, but it is a separate package a consumer
  chooses, and the layer beneath renders no styles and ships no CSS.

  PERFORMANCE records the measurement that claim rests on: across all of Phase 8,
  the headless bundles did not grow. `headless state` and `editor, no media` are
  unchanged to the byte; `react: full barrel` moved +0.9 KB, entirely from
  `useColorScheme` and `useMediaUploads` being added to the _headless_ adapter.
  `createSchema only` actually **shrank** 5.1 KB when the `/preset` entry point
  re-partitioned tsup's shared chunks.

  The package README adds a migration note: nothing breaks for an application on
  the primitives, and `editorTheme` is the cheapest way to adopt the styling
  without changing any markup.

- Updated dependencies [101c96f]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [101c96f]
- Updated dependencies [c1e0993]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [9949369]
- Updated dependencies [c1e0993]
- Updated dependencies [c1e0993]
- Updated dependencies [c1e0993]
- Updated dependencies [c1e0993]
- Updated dependencies [e93c738]
- Updated dependencies [a3bb928]
- Updated dependencies [101c96f]
- Updated dependencies [101c96f]
- Updated dependencies [9949369]
- Updated dependencies [c1e0993]
- Updated dependencies [c1e0993]
- Updated dependencies [c1e0993]
  - @sbh321/docs-editor-docx@0.1.0
  - @sbh321/docs-editor-react@0.1.0
  - @sbh321/docs-editor-core@0.1.0
  - @sbh321/docs-editor-markdown@0.1.0
  - @sbh321/docs-editor-icons@0.1.0
