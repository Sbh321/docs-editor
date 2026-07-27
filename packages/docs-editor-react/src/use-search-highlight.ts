import { findText } from "@sbh321/docs-editor-core";
import { useMemo } from "react";

import { useDecorations } from "./use-decorations";
import { useEditorState } from "./use-editor-state";

import type { Decoration, SearchMatch } from "@sbh321/docs-editor-core";

/** The decoration source used by search highlighting, so it composes with other overlays. */
export const SEARCH_DECORATION_SOURCE = "search";
/** The class added to every search match when no `matchClass` is given. */
export const DEFAULT_SEARCH_MATCH_CLASS = "docs-editor-search-match";
/** The class added to the active match when no `activeClass` is given. */
export const DEFAULT_SEARCH_MATCH_ACTIVE_CLASS = "docs-editor-search-match-active";

export interface UseSearchHighlightOptions {
  /** Match case exactly. Defaults to `false` (like a browser's find). */
  readonly caseSensitive?: boolean;
  /**
   * The index (into the returned matches) of the "current" match, which also
   * gets the {@link UseSearchHighlightOptions.activeClass}. Omit for no active
   * match — e.g. drive it from a "find next" counter.
   */
  readonly activeIndex?: number;
  /** Class applied to every match. Defaults to {@link DEFAULT_SEARCH_MATCH_CLASS}. */
  readonly matchClass?: string;
  /** Additional class applied to the active match. Defaults to {@link DEFAULT_SEARCH_MATCH_ACTIVE_CLASS}. */
  readonly activeClass?: string;
}

/**
 * Highlights every occurrence of `query` in the document (via the core
 * `findText`) and returns the matches. Headless: it only paints
 * {@link Decoration}s carrying class names — you provide the CSS (the defaults
 * are `docs-editor-search-match` / `-active`). This resolves the Milestone
 * 3.10 deferral: `findText` gave the positions; this paints them.
 *
 * Matches are recomputed whenever the document or query changes, so the
 * highlights track edits automatically. Returns the matches so the caller can
 * drive "find next" navigation and feed the chosen index back as `activeIndex`.
 */
export function useSearchHighlight(
  query: string,
  options?: UseSearchHighlightOptions,
): readonly SearchMatch[] {
  const state = useEditorState();
  const caseSensitive = options?.caseSensitive ?? false;
  const activeIndex = options?.activeIndex;
  const matchClass = options?.matchClass ?? DEFAULT_SEARCH_MATCH_CLASS;
  const activeClass = options?.activeClass ?? DEFAULT_SEARCH_MATCH_ACTIVE_CLASS;

  const matches = useMemo(
    () => (query.length > 0 ? findText(state.doc, query, { caseSensitive }) : []),
    [state.doc, query, caseSensitive],
  );

  const decorations = useMemo<readonly Decoration[]>(
    () =>
      matches.map((match, index) => ({
        from: match.from,
        to: match.to,
        attributes: {
          class: index === activeIndex ? `${matchClass} ${activeClass}` : matchClass,
        },
      })),
    [matches, activeIndex, matchClass, activeClass],
  );

  useDecorations(decorations, SEARCH_DECORATION_SOURCE);

  return matches;
}
