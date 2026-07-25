import { createContext } from "react";

import type { ComponentType, ReactNode } from "react";

/**
 * A theme's icon value: either an already-rendered node (`<BoldIcon />`) or a
 * component to render (`BoldIcon`). Accepting the component form is what lets
 * `@sbh321/docs-editor-icons`' `defaultIcons` map be passed straight through.
 */
export type ThemeIcon = ReactNode | ComponentType;

/**
 * The headless theme contract. Every field is optional — with no theme (or an
 * empty one) the UI components render unstyled and icon-free, so styling stays
 * strictly opt-in per Phase 4's "styling remains optional" exit criterion.
 *
 * A theme carries *presentation wiring only* — class names, icons, and design
 * tokens. It never carries behavior; commands, state, and document structure
 * live in the core, not here.
 */
export interface EditorTheme {
  /**
   * Class names merged onto components, keyed by a stable slot name (e.g.
   * `"toolbar"`, `"toolbarButton"`, `"toolbarButtonActive"`). A component
   * applies the slot(s) relevant to it in addition to any `className` the
   * caller passes directly.
   */
  readonly classNames?: Readonly<Record<string, string>>;
  /**
   * Icons keyed by semantic intent (`"bold"`, `"heading1"`, …). Components
   * resolve these when given an `iconName` rather than an explicit `icon`.
   * Shaped to accept `@sbh321/docs-editor-icons`' `defaultIcons` directly.
   */
  readonly icons?: Readonly<Record<string, ThemeIcon>>;
  /**
   * Design tokens exposed as CSS custom properties on the `ThemeProvider`'s
   * wrapper element. A key `"accent"` becomes `--accent`; a key already
   * prefixed with `--` is used as-is.
   */
  readonly tokens?: Readonly<Record<string, string>>;
}

export const ThemeContext = createContext<EditorTheme | null>(null);
