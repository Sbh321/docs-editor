/**
 * The HTML attributes an inline {@link Decoration} applies to the text it
 * covers. `class` and `style` are the common cases (a highlight is usually a
 * background color via one or the other); any other string attribute is
 * allowed too. Mirrors the engine's own inline-decoration attribute shape
 * without importing anything from `prosemirror-view`.
 */
export interface DecorationAttributes {
  /** CSS class(es) added to the covered range. */
  readonly class?: string;
  /** Inline CSS applied to the covered range (e.g. `"background: #fde68a"`). */
  readonly style?: string;
  /** The wrapping element's tag name. Defaults to a `<span>`. */
  readonly nodeName?: string;
  readonly [attribute: string]: string | undefined;
}

/**
 * A purely visual overlay on a document range — it paints the text between
 * `from` and `to` (adding a class, style, or attribute) **without changing the
 * document**. The building block for search-match highlighting, and for future
 * overlays like comment ranges or spellcheck squiggles.
 *
 * Decorations are *view* state, not document state: they're supplied to a live
 * {@link import("../view").EditorView} via `setDecorations`, never stored in
 * the document or a {@link import("../state").Transaction}. Positions use the
 * same linear scheme as everything else (`findText`, `Selection`, edit ranges),
 * so a `findText` match's `{ from, to }` is directly usable here.
 *
 * Deliberately plain, engine-agnostic data (no class, no `prosemirror-view`
 * dependency) so both `../engine` and `../view` can depend on it without an
 * inverted layering — the same reason `Selection` and `DOMOutputSpec` live in
 * their own modules.
 */
export interface Decoration {
  readonly from: number;
  readonly to: number;
  readonly attributes: DecorationAttributes;
  /**
   * How the decoration is applied:
   * - `"inline"` (default) wraps the covered text range in an element carrying
   *   the attributes (search highlights, comment ranges).
   * - `"node"` applies the attributes to the single block node spanning
   *   `from`..`to` (its outer element) — e.g. a `style: "margin-top: …"` to push
   *   a block down, the mechanism behind page-break spacing. `from`/`to` must be
   *   the node's own position range (`pos` … `pos + nodeSize`).
   */
  readonly type?: "inline" | "node";
}
