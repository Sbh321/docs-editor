/**
 * Rules for parsing HTML *into* the document model — the inverse of
 * {@link import("../dom-output-spec").DOMOutputSpec}. Supplied to an HTML
 * importer, decoupled from `Schema`/`NodeSpec` the same way renderers are (a
 * map you pass in, not a field baked into the schema), so a schema stays usable
 * with no parse rules at all.
 */

/** Maps a DOM tag to a node type, optionally deriving attributes from the element. */
export interface NodeParseRule<NodeName extends string = string> {
  /** The DOM tag this rule matches (e.g. `"p"`, `"h1"`, `"blockquote"`). */
  readonly tag: string;
  /** The node type to produce. */
  readonly node: NodeName;
  /**
   * Derives the node's attributes from the matched element. Return `null` to
   * *decline* the match (e.g. an `<h1>` rule that only matches when a data
   * attribute is present), letting a lower-priority rule try.
   */
  readonly getAttrs?: (element: HTMLElement) => Record<string, unknown> | null;
  /** Higher priority rules are tried first when several match the same tag. */
  readonly priority?: number;
}

/** Maps a DOM tag to a mark type, optionally deriving attributes (e.g. a link's `href`). */
export interface MarkParseRule<MarkName extends string = string> {
  readonly tag: string;
  readonly mark: MarkName;
  readonly getAttrs?: (element: HTMLElement) => Record<string, unknown> | null;
  readonly priority?: number;
}

/** The full set of node and mark parse rules an HTML importer applies. */
export interface HtmlParseSpec<NodeName extends string = string, MarkName extends string = string> {
  readonly nodes?: readonly NodeParseRule<NodeName>[];
  readonly marks?: readonly MarkParseRule<MarkName>[];
}
