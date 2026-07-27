---
"@sbh321/docs-editor-docx": minor
"@sbh321/docs-editor-react": patch
---

Text/highlight color support and page-view polish.

- **DOCX colors.** `DocxExporter` now maps a text-color mark to a run `color` and
  a highlight mark's color to a run `shading` fill; `DocxSpec` gains `highlight`,
  `textColor`, and `colorAttr`. HTML and print export already carry colors via
  their inline-style renderers; Markdown remains intentionally lossy (colors
  dropped, text preserved).
- **Page-view polish (react).** `PageSurface`'s content area now fills the page
  (min-height of one page's content box, laid out as a flex column), so a
  consuming editor can stretch to fill the page and place the caret on a click
  anywhere — reinforcing the "page, not an input field" feel. Purely visual; no
  API change.

The playground adds a `text_color` mark, gives `highlight` a color, and exposes
text/highlight color pickers (driven by the core `setMark`), plus removes the
default contenteditable focus outline and sets a page-appropriate `caret-color`.
