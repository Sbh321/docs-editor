---
"@sbh321/docs-editor-core": minor
"@sbh321/docs-editor-react": minor
---

Media accessibility as a gate (Phase 7 — Media, Milestone 7.8).

**Keyboard-operable resize and alignment.** `adjustMediaWidth(delta, options)`
widens or narrows the selected media while preserving its aspect ratio. Dragging
a corner is a pointer gesture with no keyboard equivalent, so the React node
views now bind arrow keys to resize (Shift for a larger step) and Alt+arrows to
alignment. Unmodified arrows still fall through, so the caret is never trapped
on a media node.

**`mediaAccessibilityIssues(doc, schema)`** reports a document's media
accessibility problems as data — missing alt text, an untitled embed, or media
marked decorative *and* given alt text — each with a position an application can
select or decorate. It takes the schema because a leaf node occupies one
position and a node with content occupies its content plus two, so positions
cannot be derived from a document tree alone.

Media node views are now focusable, expose `role="group"` and an `aria-label`
built from the node's description (falling back to "(no description)" so a gap
is announced rather than silent), and mark selection with `aria-selected`.

**Two fixes found by integrating media into the playground:**

- `setMediaAttrs` validated attributes *before* checking whether the command
  applied, so a toolbar dry-running it against a non-media selection threw
  `Invalid attribute "align" on "divider"` and took down the application.
  Commands now decline when the selected node's type does not declare the
  attributes. A genuinely invalid value still throws.
- `removeMedia` deleted whatever node was selected, so a button labelled "remove
  media" would delete a selected divider. It now applies only to nodes in the
  shared `media` group — which means a consumer's own media node works with
  nothing to register.
- Editing alt text updated the wrapper's label but not the image's own `alt`,
  because the element is only rebuilt when `src` changes. Text alternatives are
  now refreshed in place, without a re-fetch or a restarted video.
