import type { DOMOutputSpec } from "./dom-output-spec";
import type { DocumentNode, Mark } from "../schema";

/**
 * Maps node type names to functions describing how that node renders. Types
 * without an entry fall back to `EditorView`'s generic default (an element
 * literally named after the node) — see `docs/ROADMAP.md`'s Phase 2 notes
 * for why this lives separately from `Schema`/`NodeSpec` rather than as a
 * `toDOM` field there.
 */
export type NodeRenderer<NodeName extends string> = Partial<
  Record<NodeName, (node: DocumentNode<NodeName>) => DOMOutputSpec>
>;

/** The {@link NodeRenderer} counterpart for marks. */
export type MarkRenderer<MarkName extends string> = Partial<
  Record<MarkName, (mark: Mark<MarkName>) => DOMOutputSpec>
>;
