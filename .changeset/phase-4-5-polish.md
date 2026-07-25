---
"@sbh321/docs-editor-core": minor
---

Phase 4.5 — Polish & Foundation Gaps: close documented-but-missing foundation
capabilities so the editor behaves like a professional editor out of the box.

- **Essential editing commands + `baseKeymap`** — `splitBlock`, `joinBackward`/
  `joinForward`, `joinUp`/`joinDown`, `liftEmptyBlock`, `createParagraphNear`,
  `selectNodeBackward`/`selectNodeForward`, `selectParentNode`, and a ready-made
  `baseKeymap` (PM's platform-appropriate bindings as docs-editor `Command`s).
  Spread `baseKeymap` into a view's `keymap` and Enter splits, Backspace/Delete
  join or delete — a working editor from one line.
- **Node/block selection** — `Selection` now models `type: "node"`;
  `Transaction.selectNode(pos)` selects a whole node (e.g. an image or divider)
  as a unit, and clicking an atomic node round-trips correctly.
- **`MarkSpec` gains `inclusive?` and `excludes?`** — links can be
  non-inclusive; an inline `code` mark can exclude other formatting.
- **`removeFormatting`** command — clears every mark across the selection.
