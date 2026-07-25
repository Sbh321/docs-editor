import { useSearchHighlight } from "./use-search-highlight";

import type { UseSearchHighlightOptions } from "./use-search-highlight";

export interface SearchHighlightProps extends UseSearchHighlightOptions {
  readonly query: string;
}

/**
 * Declarative wrapper over {@link useSearchHighlight} for pure highlighting —
 * renders nothing, just paints matches of `query`. Use the hook directly when
 * you also need the matches (e.g. for "find next" navigation).
 */
export function SearchHighlight(props: SearchHighlightProps): null {
  const { query, ...options } = props;
  useSearchHighlight(query, options);
  return null;
}
