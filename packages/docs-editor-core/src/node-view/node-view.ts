/**
 * Custom node views (ROADMAP Phase 7 — Media, Milestone 7.5).
 *
 * `nodeRenderers` answers "what DOM does this node produce?" and is enough for
 * static content. It is not enough for a node the user *interacts with* — a
 * resizable image needs drag handles, a selection affordance, and the ability to
 * keep its own DOM out of the editor's mutation handling. That requires owning
 * the node's element and its lifecycle, which is what a node view is.
 *
 * The interface below is deliberately a small, documented subset of what the
 * underlying engine offers: enough for interactive nodes, without exposing the
 * engine's own view protocol (and with it, a hard dependency on ProseMirror in
 * every consumer's types).
 */

import type { DocumentNode } from "../schema";

/** What a node view is told about the node it renders. */
export interface NodeViewContext<NodeName extends string = string> {
  /** The node being rendered. */
  readonly node: DocumentNode<NodeName>;
  /**
   * The node's current position, or `null` when it cannot be determined.
   *
   * A function rather than a value because the node moves as the document is
   * edited — reading it at render time and keeping the number would produce a
   * stale position, the same trap `mediaId` avoids for uploads.
   */
  readonly getPos: () => number | null;
}

/**
 * A node view: the DOM for one node, plus optional lifecycle hooks.
 *
 * Only `dom` is required. Everything else has a sensible default, so a view
 * that just needs custom markup stays a one-liner.
 */
export interface NodeViewSpec<NodeName extends string = string> {
  /** The node's outer element. */
  readonly dom: HTMLElement;
  /**
   * Where the node's children render, for nodes with content. Omit (or pass
   * `null`) for leaf nodes such as images.
   */
  readonly contentDOM?: HTMLElement | null;
  /**
   * Called when the node changes. Return `true` if this view absorbed the
   * update, or `false` to have it torn down and rebuilt. Omitting it rebuilds
   * on every change, which is correct but loses any transient DOM state (a
   * drag in progress, say).
   */
  readonly update?: (node: DocumentNode<NodeName>) => boolean;
  /** Called when the node becomes selected as a unit. */
  readonly selectNode?: () => void;
  /** Called when the node stops being selected. */
  readonly deselectNode?: () => void;
  /**
   * Whether to ignore a DOM mutation inside this view.
   *
   * Return `true` for chrome the view manages itself — resize handles,
   * overlays, progress bars. Without it the editor treats those mutations as
   * content edits and tries to parse them back into the document.
   */
  readonly ignoreMutation?: () => boolean;
  /**
   * Whether this view handles `event` itself, stopping the editor from also
   * acting on it. Needed for drag handles, which must not start a text
   * selection or a node drag.
   */
  readonly stopEvent?: (event: Event) => boolean;
  /** Called when the view is torn down. Release listeners and observers here. */
  readonly destroy?: () => void;
}

/** Builds a node view for one node. */
export type NodeViewFactory<NodeName extends string = string> = (
  context: NodeViewContext<NodeName>,
) => NodeViewSpec<NodeName>;

/**
 * Node views by node type name.
 *
 * A type present here takes precedence over any `nodeRenderers` entry for the
 * same type — the view owns the node's DOM entirely.
 */
export type NodeViewMap<NodeName extends string = string> = Readonly<
  Partial<Record<NodeName, NodeViewFactory<NodeName>>>
>;
