# @sbh321/docs-editor-icons

## 0.1.0

### Minor Changes

- a3bb928: Phase 4 — User Interface: a headless, framework-agnostic UI layer.

  **core** — active-state queries (`isMarkActive`, `activeMarks`,
  `isBlockActive`, `activeBlockType`), `getTextBefore` for trigger detection,
  `getOutline` for document navigation, `EditorView.coordsAtPos` for anchoring
  floating UI, `Transaction.scrollIntoView`, and a decoration/overlay layer
  (`Decoration` + `EditorView.setDecorations`) for painting ranges without
  editing the document.

  **react** — query/command hooks (`useIsMarkActive`, `useIsBlockActive`,
  `useCommand`, `useOutline`, `useEditorView`) and headless UI components:
  `Toolbar`/`ToolbarButton`/`ToolbarGroup`/`ToolbarSeparator`, `FloatingToolbar`,
  `SlashMenu`, `ContextMenu`, `OutlinePanel`, `TableOfContents`, `ZoomProvider`/
  `ZoomControls`, and `ThemeProvider`, plus `useSearchHighlight`/
  `<SearchHighlight>` (and the generic `useDecorations`) for search-match
  highlighting. `<Editor />` gained a `style` prop and publishes its view via
  context. Every component is unstyled behavior only — styling and icons stay
  optional.

  **icons** (new package) — an optional default icon set: a shared `Icon` shell,
  tree-shakeable glyph components, and a `defaultIcons` map keyed by editor
  intent for feeding `ThemeProvider`.
