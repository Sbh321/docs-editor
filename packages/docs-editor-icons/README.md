# @sbh321/docs-editor-icons

Optional default icon set for [Docs Editor](../../README.md)'s headless UI
components.

> **Status:** [Phase 4 — User Interface](../../docs/ROADMAP.md#phase-4--user-interface).
> Entirely optional. The UI components in
> [@sbh321/docs-editor-react](../docs-editor-react) are headless and render
> without any icons; this package exists so you don't _have_ to draw your own
> when you'd rather not.

## What's in it

- A shared [`Icon`](./src/icon.tsx) shell — a stroked, `currentColor`, `1em`
  `<svg>` on a 24×24 grid. Use it to author icons that match the bundled set.
- Individual glyph components (`BoldIcon`, `Heading1Icon`, `LinkIcon`, …), each
  accepting `size`, `title`, and any SVG prop.
- [`defaultIcons`](./src/default-icons.ts) — a map from editor _intent_
  (`"bold"`, `"heading1"`, `"link"`, …) to a glyph component, shaped to feed
  `docs-editor-react`'s `ThemeProvider`.

## Design

- **Headless-friendly.** Icons use `stroke="currentColor"` and default to
  `size="1em"`, so they take their color and size from the surrounding text or
  button — nothing forces a palette.
- **Accessible by default.** An icon with no `title` is `aria-hidden` (assumed
  decorative, with a visible or `aria-label`'d control naming it). Pass `title`
  to expose it as a labelled image instead.
- **Tree-shakeable.** `sideEffects: false` and per-glyph exports — importing
  `BoldIcon` doesn't pull in the rest.

## Usage

```tsx
import { BoldIcon, defaultIcons } from "@sbh321/docs-editor-icons";

// Directly:
<button aria-label="Bold"><BoldIcon /></button>;

// Or through the theme, so components resolve icons by intent:
import { ThemeProvider } from "@sbh321/docs-editor-react";

<ThemeProvider icons={defaultIcons}>{/* … */}</ThemeProvider>;
```

Override individual glyphs by spreading:

```tsx
import { defaultIcons } from "@sbh321/docs-editor-icons";
import { Sparkles } from "my-icon-library";

const icons = { ...defaultIcons, link: Sparkles };
```
