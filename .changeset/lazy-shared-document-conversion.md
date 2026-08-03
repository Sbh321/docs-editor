---
"@sbh321/docs-editor-core": patch
---

Make `EditorState.doc` lazy and structurally shared, so a keystroke costs
roughly the size of the change rather than the size of the document
(Phase 6, Milestone 6.2). Internal only — no public API change.

Previously `EditorState`'s constructor eagerly converted the entire internal
ProseMirror document into a fresh plain `DocumentNode` tree, on every state
creation — so every keystroke, cursor move and undo re-walked and re-allocated
the whole document. Two changes fix it:

- `doc` is now a lazily-computed, memoized getter, so states whose document is
  never read cost nothing.
- The engine-to-model conversion walks ProseMirror nodes directly (instead of
  allocating an intermediate `toJSON()` tree and then normalizing it) and
  memoizes per node in a `WeakMap`. ProseMirror documents are persistent, so an
  edit reuses the identical objects for untouched subtrees and the conversion
  only does work along the changed path.

Measured on a 5000-paragraph document: applying a keystroke went from 4.588 ms
to 0.021 ms (~218× faster), and a selection change — which edits no content — is
now flat at 0.0004 ms at every document size (~11,900× faster). Undo/redo
improved comparably. See `docs/PERFORMANCE.md`.

Because untouched subtrees now keep their object identity, `state.doc` identity
is a reliable "did the document change?" signal, so `React.memo` and `useMemo`
over document nodes skip work that previously always re-ran.
