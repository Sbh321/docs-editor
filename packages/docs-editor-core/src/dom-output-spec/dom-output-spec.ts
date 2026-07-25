/**
 * A small, JSON-serializable description of a DOM element, used to tell
 * {@link EditorView} how to render a specific node or mark type. Deliberately
 * dependency-free (no `../schema`, no `../engine`, no `../state`) so both
 * `../engine` and `../view` can depend on it without an inverted layering —
 * same reasoning as `../selection` and `../clipboard`.
 *
 * Structurally mirrors ProseMirror's own `DOMOutputSpec` (without importing
 * anything from `prosemirror-model`): the first element is a tag name, an
 * optional plain object of attributes may follow, and any remaining elements
 * are children — nested specs, strings (text), or the number `0` (a "hole"
 * marking where this node's own content goes; required for a container node
 * or mark, and must be the only child if present).
 *
 * The first element must be the tag name string — not enforced by this type
 * itself (a fixed-head tuple can't reference itself recursively in a plain
 * type alias), only by convention and by `EditorView` at render time.
 */
export type DOMOutputSpec = readonly (
  string | 0 | Readonly<Record<string, string>> | DOMOutputSpec
)[];
