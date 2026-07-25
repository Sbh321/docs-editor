/**
 * Declares the default value for an attribute. An attribute without a
 * default must be supplied explicitly every time a node or mark of that
 * type is created.
 */
export interface AttributeSpec {
  readonly default?: unknown;
}

/**
 * Declares one node type in a {@link SchemaSpec}.
 *
 * `content` is a small sequence-and-quantifier expression (e.g. `"paragraph+"`,
 * `"inline*"`) describing which child node types or groups are allowed, and
 * how many of them. It does not yet support alternation or grouping (e.g.
 * `"(paragraph | heading)*"`) — every node type in Phase 1 has a single,
 * unambiguous child sequence, so that expressiveness isn't needed yet. See
 * `content-expression.ts` for the supported grammar.
 */
export interface NodeSpec {
  readonly content?: string;
  readonly group?: string;
  readonly inline?: boolean;
  readonly isText?: boolean;
  /**
   * Which marks a node of this type may carry, checked by
   * `Schema.text()`/`Schema.node()` when a node of this type is
   * constructed. Declare this on the node that *carries* the mark (e.g.
   * `text: { marks: "all" }`), not on whatever contains it — the engine
   * adapter separately derives ProseMirror's own container-level marks
   * constraint from this field, so it doesn't need to be (and shouldn't be)
   * duplicated on container node types.
   */
  readonly marks?: "none" | "all" | readonly string[];
  readonly attrs?: Readonly<Record<string, AttributeSpec>>;
  /**
   * Marks this node type as holding literal, unformatted text (e.g. a code
   * block) rather than rich content — affects how the engine adapter treats
   * Enter (inserts a newline instead of splitting into a new block) and
   * clipboard serialization (plain text, not marks/rich content).
   */
  readonly code?: boolean;
  /**
   * Declares this node's role in a table structure, enabling the engine's
   * table support (cell selection, row/column commands) to recognize it. A
   * table is a `"table"` containing `"row"`s, each containing `"cell"`s
   * and/or `"header_cell"`s. Omit for any node that isn't part of a table.
   * Cells additionally need `colspan`/`rowspan` attributes (and optionally
   * `colwidth`); see the Schema section of the package README.
   */
  readonly tableRole?: "table" | "row" | "cell" | "header_cell";
  /**
   * When `true`, edits can't cross this node's boundary — e.g. pressing
   * Backspace at the start of the node won't join it into its previous
   * sibling. Recommended for table cells so structural edits stay contained;
   * defaults to `false`.
   */
  readonly isolating?: boolean;
}

/** Declares one mark type in a {@link SchemaSpec}. */
export interface MarkSpec {
  readonly attrs?: Readonly<Record<string, AttributeSpec>>;
  /**
   * Whether the mark extends onto content inserted at its end. `true` (the
   * default) is right for most formatting (typing at the end of bold text
   * stays bold); set `false` for marks that shouldn't grow this way — a link,
   * so typing just past it isn't part of the link.
   */
  readonly inclusive?: boolean;
  /**
   * Which marks this one excludes, as a space-separated list of mark type
   * names (or `"_"` for *all* other marks). A mark always excludes itself, so
   * applying it replaces an existing one of the same type. Use `"_"` for an
   * inline `code` mark so it can't combine with bold/italic/etc.
   */
  readonly excludes?: string;
}

/** The full set of node and mark types a {@link Schema} enforces. */
export interface SchemaSpec<NodeName extends string = string, MarkName extends string = string> {
  readonly topNode?: NodeName;
  readonly nodes: Readonly<Record<NodeName, NodeSpec>>;
  readonly marks?: Readonly<Record<MarkName, MarkSpec>>;
}

/** A single formatting mark applied to a node (e.g. bold, a link). */
export interface Mark<MarkName extends string = string> {
  readonly type: MarkName;
  readonly attrs: Readonly<Record<string, unknown>>;
}

/**
 * A node in the document tree. Plain, readonly, JSON-safe data — never a
 * class instance — so documents are trivially serializable and safe to
 * pass across worker/network boundaries.
 *
 * Text nodes carry their string in `text` and have empty `content`; every
 * other node type carries children in `content` and omits `text`. Use
 * {@link isTextNode} to narrow between the two at runtime.
 */
export interface DocumentNode<NodeName extends string = string> {
  readonly type: NodeName;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly content: readonly DocumentNode<NodeName>[];
  readonly marks: readonly Mark[];
  readonly text?: string;
}

/** Narrows a {@link DocumentNode} to one that carries text. */
export function isTextNode<NodeName extends string>(
  node: DocumentNode<NodeName>,
): node is DocumentNode<NodeName> & { readonly text: string } {
  return typeof node.text === "string";
}
