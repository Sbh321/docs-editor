---
"@sbh321/docs-editor": minor
"@sbh321/docs-editor-react": minor
---

Add `@sbh321/docs-editor` with its design tokens, and resolve light/dark out of
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
/ `--de-muted-foreground`), so a dark scheme is a different set of *values*
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
