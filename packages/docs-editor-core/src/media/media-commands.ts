/**
 * Media commands (ROADMAP Phase 7 — Media, Milestone 7.2).
 *
 * These are ordinary {@link Command}s built on the existing `Transaction`
 * primitives — no new engine surface — following the same pattern as the
 * formatting commands. Every one that changes attributes validates through
 * `Schema.blockType()` first, so an invalid alignment or a negative width fails
 * with an actionable schema error rather than silently corrupting a node.
 */

import { selectedNode } from "../queries";
import { nodeGroups } from "../schema";

import { isMediaAlignment, MEDIA_ATTRS, MEDIA_GROUP } from "./media-types";

import type { MediaAlignment } from "./media-types";
import type { Command, Dispatch } from "../commands";
import type { DocumentNode } from "../schema";
import type { EditorState } from "../state";

export interface InsertMediaOptions {
  /**
   * Wrap the media in a figure so it can carry a caption. Defaults to `false`
   * (a bare media node).
   */
  readonly figure?: boolean;
  /** Caption text. Implies `figure`. */
  readonly caption?: string;
  /** Figure node type name. Defaults to `"figure"`. */
  readonly figureType?: string;
  /** Caption node type name. Defaults to `"caption"`. */
  readonly captionType?: string;
}

/**
 * Inserts a media node at the selection, optionally wrapped in a captioned
 * figure.
 *
 * `type` is a plain `string` for the same reason as
 * {@link import("../commands").toggleMark}'s `markType`: the target editor's
 * `NodeName` union isn't known where the command is created. `Schema.node()`
 * validates it against the real schema at call time.
 */
export function insertMedia(
  type: string,
  attrs?: Record<string, unknown>,
  options: InsertMediaOptions = {},
) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const { figure = options.caption !== undefined, caption, figureType = "figure" } = options;
    const captionType = options.captionType ?? "caption";

    const media = state.schema.node(type as NodeName, attrs);
    let node: DocumentNode<NodeName> = media;

    if (figure) {
      const children: DocumentNode<NodeName>[] = [media];
      // An empty caption node would be valid but pointless; only add one when
      // there is text for it.
      if (caption !== undefined && caption.length > 0) {
        children.push(
          state.schema.node(captionType as NodeName, undefined, [state.schema.text(caption)]),
        );
      }
      node = state.schema.node(figureType as NodeName, undefined, children);
    }

    dispatch?.(state.tr.insertNode(node));
    return true;
  };
}

/**
 * Merges `attrs` into the selected node's attributes.
 *
 * Reports `false` when the selection isn't a node selection, or when the
 * selected node's type doesn't declare the attributes being set — so a toolbar
 * button can disable itself by dry-running it (calling it without `dispatch`).
 *
 * That second case is the difference between "this command doesn't apply here"
 * and "this value is wrong". Selecting a divider and hovering an alignment
 * button is ordinary use, so it must *decline*; passing `align: "diagonal"` to a
 * real image is a programmer error and still throws. Validating before checking
 * would make the dry run itself throw, which takes the whole application down.
 */
export function setMediaAttrs(attrs: Record<string, unknown>) {
  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const selected = selectedNode<NodeName, MarkName>(state);
    if (!selected) {
      return false;
    }
    if (!declaresAttrs(state, selected.node.type, attrs)) {
      return false;
    }
    // Merge onto the node's current attributes and re-validate the whole set,
    // so a partial update can't drop attributes or smuggle in an invalid value.
    const merged = { ...selected.node.attrs, ...attrs };
    const validated = state.schema.blockType(selected.node.type, merged);
    dispatch?.(state.tr.setNodeAttrs(selected.from, validated.attrs));
    return true;
  };
}

/**
 * Whether `type` is a media node, judged by its **group** rather than a list of
 * known type names.
 *
 * `mediaNodeSpecs` puts every media type in {@link MEDIA_GROUP}, which is also
 * how `figure` accepts any media without enumerating types — so a consumer's own
 * media node that joins the group works here too, with nothing to register.
 */
function isMediaNode<NodeName extends string, MarkName extends string>(
  state: EditorState<NodeName, MarkName>,
  type: NodeName,
): boolean {
  return nodeGroups(state.schema.spec.nodes[type]?.group).includes(MEDIA_GROUP);
}

/** Whether `type` declares every attribute in `attrs`. */
function declaresAttrs<NodeName extends string, MarkName extends string>(
  state: EditorState<NodeName, MarkName>,
  type: NodeName,
  attrs: Record<string, unknown>,
): boolean {
  const declared = state.schema.spec.nodes[type]?.attrs;
  if (!declared) {
    return false;
  }
  return Object.keys(attrs).every((name) => name in declared);
}

/** Sets the selected media's alignment. */
export function setMediaAlignment(alignment: MediaAlignment): Command {
  if (!isMediaAlignment(alignment)) {
    // A programmer error, not user input — fail loudly at the call site rather
    // than writing an unrenderable value into the document.
    throw new TypeError(
      `Invalid media alignment "${String(alignment)}". Expected one of: left, center, right, wide, full.`,
    );
  }
  return setMediaAttrs({ [MEDIA_ATTRS.align]: alignment });
}

/**
 * Resizes the selected media. Pass `null` for either dimension to clear it and
 * fall back to the media's natural size.
 */
export function setMediaSize(size: {
  readonly width?: number | null;
  readonly height?: number | null;
}): Command {
  const attrs: Record<string, unknown> = {};
  if (size.width !== undefined) {
    attrs[MEDIA_ATTRS.width] = requireNonNegative(size.width, "width");
  }
  if (size.height !== undefined) {
    attrs[MEDIA_ATTRS.height] = requireNonNegative(size.height, "height");
  }
  return setMediaAttrs(attrs);
}

export interface AdjustMediaWidthOptions {
  /**
   * Width to treat as the current one when the node has no explicit `width`.
   *
   * A node sized naturally carries `width: null`, so there is nothing in the
   * *model* to add a delta to — only the rendered element knows how wide it is.
   * The view measures it and passes it here, which keeps the arithmetic in a
   * testable command instead of scattered through node views.
   */
  readonly currentWidth?: number;
  /** Smallest width the adjustment may produce. Defaults to 16. */
  readonly minWidth?: number;
  /** Largest width the adjustment may produce, when the container bounds it. */
  readonly maxWidth?: number;
}

/**
 * Widens or narrows the selected media by `delta` pixels, preserving its aspect
 * ratio.
 *
 * This is what makes resizing **keyboard-operable**: dragging a corner is a
 * pointer gesture with no keyboard equivalent, and CLAUDE.md treats an
 * accessibility regression as a bug. A node view binds this to the arrow keys;
 * a toolbar can bind it to buttons.
 *
 * Reports `false` when nothing is selected, or when the media has no explicit
 * width and the caller supplied no {@link AdjustMediaWidthOptions.currentWidth}
 * to compute from — there is no sensible guess to make there.
 */
export function adjustMediaWidth(delta: number, options: AdjustMediaWidthOptions = {}): Command {
  if (!Number.isFinite(delta)) {
    throw new TypeError(`Invalid media width delta "${String(delta)}". Expected a finite number.`);
  }

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const selected = selectedNode<NodeName, MarkName>(state);
    if (!selected) {
      return false;
    }

    const { minWidth = 16, maxWidth, currentWidth } = options;
    const attrWidth = selected.node.attrs[MEDIA_ATTRS.width];
    const base = typeof attrWidth === "number" ? attrWidth : currentWidth;
    if (typeof base !== "number" || !Number.isFinite(base)) {
      return false;
    }

    let width = Math.max(minWidth, Math.round(base + delta));
    if (typeof maxWidth === "number") {
      width = Math.min(maxWidth, width);
    }
    if (width === attrWidth) {
      // Already at the bound — report handled so the key doesn't fall through
      // to the editor and move the selection instead.
      return true;
    }

    // Scale an explicit height with the width, so a keyboard resize distorts
    // nothing. A node sized naturally has no height to keep in step.
    const attrHeight = selected.node.attrs[MEDIA_ATTRS.height];
    const attrs: Record<string, unknown> = { [MEDIA_ATTRS.width]: width };
    if (typeof attrHeight === "number" && base > 0) {
      attrs[MEDIA_ATTRS.height] = Math.max(1, Math.round(attrHeight * (width / base)));
    }

    // Delegated rather than routed through `setMediaSize`, which is typed as a
    // concrete `Command` and so cannot accept this call's `Dispatch<NodeName>`.
    return setMediaAttrs(attrs)(state, dispatch);
  };
}

/**
 * Sets alternative text on the selected media.
 *
 * Passing `decorative: true` marks the media as purely decorative so assistive
 * technology skips it. That is recorded explicitly rather than inferred from an
 * empty `alt`, because "deliberately decorative" and "the author forgot" are
 * indistinguishable in the markup but very different for accessibility review.
 */
export function setMediaAlt(alt: string, options: { readonly decorative?: boolean } = {}): Command {
  const attrs: Record<string, unknown> = { [MEDIA_ATTRS.alt]: alt };
  if (options.decorative !== undefined) {
    attrs[MEDIA_ATTRS.decorative] = options.decorative;
  }
  return setMediaAttrs(attrs);
}

/**
 * Removes the selected media.
 *
 * When the media is the only child of a wrapping figure, the figure goes too:
 * a `figure` whose content expression requires media would be left invalid, so
 * removing just the media would produce a document that fails validation.
 */
export function removeMedia<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  dispatch?: Dispatch<NodeName>,
): boolean {
  const selected = selectedNode<NodeName, MarkName>(state);
  if (!selected) {
    return false;
  }
  // Only media. Without this the command would delete whatever happened to be
  // selected — a divider, a table — which is not what a button labelled
  // "remove media" should do, and would leave it wrongly enabled for every
  // node selection.
  if (!isMediaNode(state, selected.node.type)) {
    return false;
  }

  const { parent } = selected;
  // Remove the parent too when it could not legally survive losing this child.
  // Asking the schema is what makes this correct for every structure rather
  // than only the cases we thought of: a `figure` holding just a caption fails
  // its `media caption?` expression exactly as one holding nothing does, so an
  // "is it the only child?" test would have quietly produced an invalid
  // document in the captioned case.
  const removesParentToo = parent !== null && !canSurviveWithout(state, parent);
  const from = removesParentToo && parent ? parent.from : selected.from;
  const to = removesParentToo && parent ? parent.to : selected.to;

  dispatch?.(state.tr.delete(from, to));
  return true;
}

/** Whether `parent` still satisfies its content expression without the child at `index`. */
function canSurviveWithout<NodeName extends string, MarkName extends string>(
  state: EditorState<NodeName, MarkName>,
  parent: { readonly node: DocumentNode<NodeName>; readonly index: number },
): boolean {
  const remaining = parent.node.content.filter((_, index) => index !== parent.index);
  try {
    state.schema.node(parent.node.type, parent.node.attrs, remaining);
    return true;
  } catch {
    // The schema rejected it — the parent cannot exist without this child.
    return false;
  }
}

function requireNonNegative(value: number | null, label: string): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `Invalid media ${label} "${String(value)}". Expected a non-negative number.`,
    );
  }
  return value;
}
