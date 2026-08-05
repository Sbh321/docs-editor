---
"@sbh321/docs-editor-react": minor
"@sbh321/docs-editor": minor
---

Add `useMediaUploads`, and complete the editor surfaces (Phase 8 —
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
`ZoomControls` changes it, but *applying* it is the consumer's job — and
`<DocsEditor>` was not doing it, so the controls moved a number that scaled
nothing.
