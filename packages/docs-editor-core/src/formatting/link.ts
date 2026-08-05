/**
 * Links (ROADMAP Phase 9, Milestone 9.2).
 *
 * Before this, "insert link" was `toggleMark("link", { href: "" })` — it marked
 * text as a link with a **literally empty target** and there was no way to read
 * or change an existing one. This is the real thing: a link has a destination,
 * optionally a title and a target, it can be read back out of the document, and
 * its URL is checked before it ever reaches an attribute a browser will follow.
 *
 * ## Security
 *
 * `isSafeLinkUrl` is stricter than media's `isSafeMediaUrl`, and deliberately
 * not the same function. Media allows `data:` for inline images, which is safe
 * in an `<img src>` and **not** safe in an `<a href>`: `data:text/html` in a
 * link is a straightforward script-execution vector, as is `javascript:`. The
 * two policies answer different questions and would drift into one wrong answer
 * if merged.
 */

import { engineMarkRangeAtSelection } from "../engine";
import { activeMarks } from "../queries";
import { isSelectionEmpty, selectionFrom, selectionTo } from "../selection";

import type { Dispatch } from "../commands";
import type { MarkSpec } from "../schema";
import type { EditorState } from "../state";

/** Attribute names the link mark uses, named once so nothing drifts over a spelling. */
export const LINK_ATTRS = {
  href: "href",
  title: "title",
  target: "target",
} as const;

/** The mark name these commands operate on by default. */
export const LINK_MARK = "link";

/**
 * Schemes a link may use.
 *
 * `mailto` and `tel` are here because they are ordinary in documents and
 * harmless — they hand off to another application rather than executing.
 * `data` and `blob` are absent on purpose: both can carry an HTML payload that
 * a browser will run in the page's origin.
 */
const SAFE_LINK_PROTOCOLS: readonly string[] = ["http", "https", "mailto", "tel"];

/**
 * Whether a URL is safe to place in a link's `href`.
 *
 * A URL with no scheme (relative, anchor, or protocol-relative) is accepted: it
 * cannot name an executable scheme. Everything with a scheme must be on the
 * allow-list — an allow-list rather than a `javascript:` block-list, because
 * blocking known-bad schemes loses to `java\nscript:`, entity encoding, and
 * whatever the next bypass is.
 */
export function isSafeLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return false;
  }
  // Control characters and whitespace are stripped *before the scheme is read*,
  // because browsers ignore them when resolving one: `java\tscript:alert(1)`
  // and `java\nscript:alert(1)` both navigate. Only this local copy is
  // stripped -- the URL itself is returned untouched, so a legitimate one keeps
  // whatever it contained.
  //
  // The rule against control characters in a regular expression is suppressed
  // because matching them is the entire point here: they are exactly what an
  // attacker hides a scheme behind.
  // eslint-disable-next-line no-control-regex
  const cleaned = trimmed.replace(/[\u0000-\u0020\u007f]/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned)?.[1]?.toLowerCase();
  if (scheme === undefined) {
    return true;
  }
  return SAFE_LINK_PROTOCOLS.includes(scheme);
}

/**
 * Turns what a person typed into a URL, or returns `null` when it cannot be one.
 *
 * `example.com` becomes `https://example.com`, because someone typing a bare
 * domain into a link field means a website, and a relative path is not what they
 * meant. Anything already carrying a scheme, an anchor (`#section`) or an
 * explicit path (`/docs`) is left exactly as typed — guessing at those would
 * break the cases where the author knew what they wanted.
 */
export function normalizeLinkHref(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!isSafeLinkUrl(trimmed)) {
    return null;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const isRooted = trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?");
  if (hasScheme || isRooted) {
    return trimmed;
  }
  // A bare `user@host` is an email address, not a hostname.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  // Looks like a domain (something.tld, optionally with a path) — assume https.
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

/** A link found in the document, with everything an editor needs to change it. */
export interface ActiveLink {
  readonly href: string;
  readonly title: string | null;
  readonly target: string | null;
  /** Start of the whole link run, not of the selection inside it. */
  readonly from: number;
  readonly to: number;
  /** The link's visible text. */
  readonly text: string;
}

export interface LinkOptions {
  /** Mark name to operate on. Defaults to {@link LINK_MARK}. */
  readonly markName?: string;
}

export interface InsertLinkOptions extends LinkOptions {
  /**
   * Range to replace, instead of the current selection.
   *
   * What lets a link editor change an existing link's *display text*: the run
   * to replace is the link's, not the selection's, and passing it here keeps
   * the whole edit in one transaction. Moving the selection first and then
   * inserting would be two dispatches, and the second would read a state that
   * predates the first.
   */
  readonly range?: { readonly from: number; readonly to: number };
}

/**
 * The link the cursor sits in, or `null`.
 *
 * Reports the **whole** run, not the slice under the cursor: editing a link
 * means replacing all of it, and a dialog has to show the existing URL to be
 * an editor rather than a re-entry form.
 */
export function activeLink<NodeName extends string = string, MarkName extends string = string>(
  state: EditorState<NodeName, MarkName>,
  options: LinkOptions = {},
): ActiveLink | null {
  const markName = options.markName ?? LINK_MARK;
  const range = engineMarkRangeAtSelection(state.engine, markName);
  if (!range) {
    return null;
  }
  const href = range.attrs[LINK_ATTRS.href];
  return {
    href: typeof href === "string" ? href : "",
    title: readOptionalString(range.attrs[LINK_ATTRS.title]),
    target: readOptionalString(range.attrs[LINK_ATTRS.target]),
    from: range.from,
    to: range.to,
    text: range.text,
  };
}

export interface SetLinkAttrs {
  /** Where the link points. Normalized and checked; an unsafe URL declines. */
  readonly href: string;
  /** Tooltip text the browser shows on hover. */
  readonly title?: string | null;
  /** `"_blank"` to open in a new tab. `rel` is derived at render time, never stored. */
  readonly target?: string | null;
}

/**
 * Applies (or replaces) a link over the selection.
 *
 * With a **collapsed cursor inside an existing link**, the whole link is
 * retargeted rather than nothing happening — which is what "edit this link"
 * means, and the case the old empty-href toggle could not express at all.
 *
 * Reports `false` when the URL is unsafe or unparseable, and when the cursor is
 * collapsed outside any link (there is no text to link — see
 * {@link insertLink}, which supplies its own).
 */
export function setLink(attrs: SetLinkAttrs, options: LinkOptions = {}) {
  const markName = options.markName ?? LINK_MARK;

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const href = normalizeLinkHref(attrs.href);
    if (href === null) {
      return false;
    }

    const range = linkRange(state, markName);
    if (range === null) {
      return false;
    }

    if (dispatch) {
      const mark = state.schema.mark(markName as MarkName, {
        [LINK_ATTRS.href]: href,
        [LINK_ATTRS.title]: attrs.title ?? null,
        [LINK_ATTRS.target]: attrs.target ?? null,
      });
      // Removed before adding: `addMark` over text that already carries a link
      // would leave the old destination in place on part of the range.
      dispatch(
        state.tr
          .removeMark(range.from, range.to, markName as MarkName)
          .addMark(range.from, range.to, mark),
      );
    }
    return true;
  };
}

/**
 * Inserts new text carrying a link, replacing the selection.
 *
 * The case {@link setLink} cannot serve: a cursor sitting in empty space, where
 * the user supplies both the destination and the words to show.
 */
export function insertLink(
  attrs: SetLinkAttrs & { readonly text: string },
  options: InsertLinkOptions = {},
) {
  const markName = options.markName ?? LINK_MARK;

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const href = normalizeLinkHref(attrs.href);
    if (href === null || attrs.text.length === 0) {
      return false;
    }

    if (dispatch) {
      const from = options.range?.from ?? selectionFrom(state.selection);
      const to = options.range?.to ?? selectionTo(state.selection);
      const mark = state.schema.mark(markName as MarkName, {
        [LINK_ATTRS.href]: href,
        [LINK_ATTRS.title]: attrs.title ?? null,
        [LINK_ATTRS.target]: attrs.target ?? null,
      });
      const tr = state.tr.insertText(attrs.text, from, to);
      dispatch(tr.addMark(from, from + attrs.text.length, mark));
    }
    return true;
  };
}

/**
 * Removes the link around the cursor, or across the selection.
 *
 * Like {@link setLink}, a collapsed cursor removes the *whole* link rather than
 * a zero-width slice of it — otherwise the button would appear to do nothing.
 */
export function removeLink(options: LinkOptions = {}) {
  const markName = options.markName ?? LINK_MARK;

  return <NodeName extends string = string, MarkName extends string = string>(
    state: EditorState<NodeName, MarkName>,
    dispatch?: Dispatch<NodeName>,
  ): boolean => {
    const range = linkRange(state, markName);
    if (range === null || range.from === range.to) {
      return false;
    }
    // Nothing to remove if no link is actually there.
    if (!activeMarks(state).some((mark) => mark.type === markName)) {
      return false;
    }
    dispatch?.(state.tr.removeMark(range.from, range.to, markName as MarkName));
    return true;
  };
}

/**
 * The range a link command should act on: the selection when there is one,
 * otherwise the whole link the cursor sits in, otherwise `null`.
 */
function linkRange<NodeName extends string, MarkName extends string>(
  state: EditorState<NodeName, MarkName>,
  markName: string,
): { from: number; to: number } | null {
  if (!isSelectionEmpty(state.selection)) {
    return { from: selectionFrom(state.selection), to: selectionTo(state.selection) };
  }
  const range = engineMarkRangeAtSelection(state.engine, markName);
  return range ? { from: range.from, to: range.to } : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The link mark's spec.
 *
 * `inclusive: false` is what stops a link swallowing the words typed after it.
 * `title` and `target` default to `null` rather than `""` so "absent" and
 * "empty" stay distinguishable through a serialization round-trip.
 */
export function linkMarkSpec(): MarkSpec {
  return {
    attrs: {
      [LINK_ATTRS.href]: {},
      [LINK_ATTRS.title]: { default: null },
      [LINK_ATTRS.target]: { default: null },
    },
    inclusive: false,
  };
}

/**
 * The HTML attributes a link renders to.
 *
 * Two things happen here that callers must not have to remember:
 *
 * **The href is re-checked on the way out.** A document can acquire an unsafe
 * URL by routes these commands never see — an imported file, a pasted
 * fragment, a document built programmatically — so export sanitizes rather than
 * trusting that input validation happened. Before Phase 9 this was missing and
 * `javascript:` in a link survived into exported markup, while the equivalent
 * media path had been sanitized since Phase 7.
 *
 * **`rel` is derived, never stored.** A `target="_blank"` link without
 * `rel="noopener"` hands the opened page a reference back to this one. Deriving
 * it means every such link gets it — including ones imported from documents
 * that omitted it — where a stored attribute would faithfully preserve the
 * omission.
 */
export function linkAttributes(attrs: Readonly<Record<string, unknown>>): Record<string, string> {
  const href = attrs[LINK_ATTRS.href];
  const safe = typeof href === "string" && isSafeLinkUrl(href) ? href.trim() : "";
  const out: Record<string, string> = { href: safe };

  const title = readOptionalString(attrs[LINK_ATTRS.title]);
  if (title !== null) {
    out.title = title;
  }

  const target = readOptionalString(attrs[LINK_ATTRS.target]);
  if (target !== null) {
    out.target = target;
    if (target === "_blank") {
      out.rel = "noopener noreferrer";
    }
  }

  return out;
}
