/**
 * The design-token vocabulary (ROADMAP Phase 8, Milestone 8.2).
 *
 * The values live in `styles.css`; this is the *list of names*, so a consumer
 * has something typed to override against and the stylesheet has something to
 * be checked against. Keeping them in one place is what stops a token being
 * added to the CSS and never documented, or documented and never defined.
 *
 * ```ts
 * import { DOCS_EDITOR_TOKENS } from "@sbh321/docs-editor";
 * ```
 *
 * Override them anywhere the cascade reaches the editor:
 *
 * ```css
 * :root {
 *   --de-accent: #7c3aed;
 *   --de-radius: 10px;
 * }
 * ```
 */

/**
 * Colour tokens, as foreground/background **pairs** named for their role rather
 * than their appearance.
 *
 * The pairing is what makes a dark scheme a different set of *values* instead
 * of a different set of rules — a component asks for `--de-muted` and
 * `--de-muted-foreground` and is correct in both schemes without knowing which
 * one it is in.
 */
export const COLOR_TOKENS = [
  "--de-background",
  "--de-foreground",
  "--de-surface",
  "--de-surface-foreground",
  "--de-muted",
  "--de-muted-foreground",
  "--de-accent-subtle",
  "--de-accent-subtle-foreground",
  "--de-primary",
  "--de-primary-foreground",
  "--de-primary-hover",
  "--de-destructive",
  "--de-destructive-foreground",
  "--de-destructive-hover",
  "--de-accent",
  "--de-accent-foreground",
  "--de-selection",
  "--de-border",
  "--de-border-strong",
  "--de-input",
  "--de-ring",
  "--de-success",
  "--de-warning",
  "--de-danger",
  "--de-page",
  "--de-page-foreground",
  "--de-canvas",
  "--de-tooltip",
  "--de-tooltip-foreground",
] as const;

/** Corner radii. Derived from `--de-radius`, so one override reshapes everything. */
export const RADIUS_TOKENS = [
  "--de-radius",
  "--de-radius-sm",
  "--de-radius-lg",
  "--de-radius-full",
] as const;

/** Spacing, on a 4px scale so component padding stays on a rhythm. */
export const SPACE_TOKENS = [
  "--de-space-1",
  "--de-space-2",
  "--de-space-3",
  "--de-space-4",
  "--de-space-5",
  "--de-space-6",
] as const;

/**
 * Typography. `--de-font-document` is deliberately separate from
 * `--de-font-ui`: the interface should look native to the operating system,
 * while the document should look like a document.
 */
export const TYPOGRAPHY_TOKENS = [
  "--de-font-ui",
  "--de-font-document",
  "--de-font-mono",
  "--de-text-xs",
  "--de-text-sm",
  "--de-text-base",
  "--de-text-lg",
  "--de-leading-tight",
  "--de-leading-normal",
  "--de-leading-relaxed",
] as const;

/** Shadows, including the one that lifts the page off the canvas. */
export const ELEVATION_TOKENS = [
  "--de-shadow-sm",
  "--de-shadow",
  "--de-shadow-lg",
  "--de-page-shadow",
] as const;

/** The focus ring — one treatment everywhere, and only for keyboard users. */
export const FOCUS_TOKENS = ["--de-ring-width", "--de-ring-offset"] as const;

/** Layout metrics the shell reads. */
export const LAYOUT_TOKENS = ["--de-toolbar-height", "--de-sidebar-width"] as const;

/** Motion. Short by default: waiting for a menu is worse than a menu that appears. */
export const MOTION_TOKENS = ["--de-duration-fast", "--de-duration", "--de-ease"] as const;

/** Every token the stylesheet defines. */
export const DOCS_EDITOR_TOKENS = [
  ...COLOR_TOKENS,
  ...RADIUS_TOKENS,
  ...SPACE_TOKENS,
  ...TYPOGRAPHY_TOKENS,
  ...ELEVATION_TOKENS,
  ...FOCUS_TOKENS,
  ...LAYOUT_TOKENS,
  ...MOTION_TOKENS,
] as const;

/** The name of a token in {@link DOCS_EDITOR_TOKENS}. */
export type DocsEditorToken = (typeof DOCS_EDITOR_TOKENS)[number];

/**
 * Colour pairs that carry text and must therefore meet WCAG AA (4.5:1) in both
 * schemes. Verified by `tokens.test.ts` against the stylesheet itself.
 *
 * `--de-muted-foreground` is included deliberately: "secondary" text is exactly
 * where contrast is quietly allowed to fail, and it is still text people read.
 */
export const TEXT_CONTRAST_PAIRS: readonly (readonly [DocsEditorToken, DocsEditorToken])[] = [
  ["--de-foreground", "--de-background"],
  ["--de-surface-foreground", "--de-surface"],
  ["--de-muted-foreground", "--de-background"],
  ["--de-muted-foreground", "--de-muted"],
  // The `secondary` button (Phase 9): body foreground on the muted fill.
  ["--de-surface-foreground", "--de-muted"],
  ["--de-primary-foreground", "--de-primary"],
  ["--de-destructive-foreground", "--de-destructive"],
  ["--de-accent-foreground", "--de-accent"],
  ["--de-page-foreground", "--de-page"],
  // Tooltips are text on an inverted surface (Phase 9.12).
  ["--de-tooltip-foreground", "--de-tooltip"],
  // Hover states must not dip below AA mid-interaction.
  ["--de-primary-foreground", "--de-primary-hover"],
  ["--de-destructive-foreground", "--de-destructive-hover"],
];

/**
 * Pairs that only outline or fill a shape, so they are held to WCAG's
 * non-text minimum (3:1) rather than the text minimum.
 */
export const NON_TEXT_CONTRAST_PAIRS: readonly (readonly [DocsEditorToken, DocsEditorToken])[] = [
  ["--de-border-strong", "--de-background"],
  ["--de-ring", "--de-background"],
  ["--de-accent", "--de-background"],
];
