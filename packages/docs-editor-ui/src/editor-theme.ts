/**
 * The default theme (ROADMAP Phase 8, Milestone 8.4).
 *
 * The headless UI layer already resolves a class name per *slot* — `"toolbar"`,
 * `"slashMenuOptionActive"`, `"pageCanvas"` — which is the extension point
 * Phase 4 built for exactly this. So styling those components means filling the
 * slots, not wrapping or reimplementing them.
 *
 * That is why this package can style the headless components without either
 * layer knowing about the other: the slot names are the contract.
 */

import { defaultIcons } from "@sbh321/docs-editor-icons";

import type { EditorTheme } from "@sbh321/docs-editor-react";

/** Class names for every slot the headless components resolve. */
export const editorThemeClassNames: Readonly<Record<string, string>> = {
  toolbar: "de-toolbar",
  toolbarGroup: "de-toolbar__group",
  toolbarButton: "de-button de-button--ghost de-button--icon",
  toolbarButtonActive: "de-button--pressed",
  toolbarSeparator: "de-separator de-separator--vertical",

  floatingToolbar: "de-floating-toolbar",

  slashMenu: "de-menu de-slash-menu",
  slashMenuOption: "de-menu__item",
  slashMenuOptionActive: "de-menu__item--active",

  contextMenu: "de-menu",
  contextMenuItem: "de-menu__item",

  outline: "de-outline",
  outlineItem: "de-outline__item",
  tableOfContents: "de-toc",
  tableOfContentsList: "de-toc__list",
  tableOfContentsItem: "de-toc__item",

  blockDragHandle: "de-drag-handle",
  blockDropIndicator: "de-drop-indicator",

  pageCanvas: "de-canvas",
  page: "de-page",
  pageContent: "de-page-content",
  pageHeader: "de-page__header",
  pageFooter: "de-page__footer",
  pageSetup: "de-page-setup",

  zoomControls: "de-zoom",
  zoomButton: "de-button de-button--ghost de-button--icon-sm",
  // Reuses the button styles rather than restating them: the readout *is* a
  // button (it resets the zoom), and given only typography it falls back to the
  // browser's native `ButtonFace` chrome — a system colour that ignores the
  // theme and looks broken in both schemes.
  zoomLabel: "de-button de-button--ghost de-zoom__label",
};

/**
 * The theme to pass to `ThemeProvider`.
 *
 * Icons come from `@sbh321/docs-editor-icons`, which is a direct dependency
 * here rather than of the headless packages — an application using the
 * primitives with its own icon set should not download a second one.
 *
 * ```tsx
 * <ThemeProvider theme={editorTheme}>…</ThemeProvider>
 * ```
 *
 * Spread it to adjust a slot without losing the rest:
 *
 * ```tsx
 * const mine = {
 *   ...editorTheme,
 *   classNames: { ...editorTheme.classNames, toolbar: "my-toolbar" },
 * };
 * ```
 */
export const editorTheme: EditorTheme = {
  classNames: editorThemeClassNames,
  icons: defaultIcons,
};
