import { useContext } from "react";

import { PageLayoutContext } from "./page-layout-context";

import type { PageLayoutContextValue } from "./page-layout-context";

/**
 * Reads the current page layout and controls from the nearest
 * `PageLayoutProvider`. Throws when used outside one — layout needs shared
 * state between the setup controls, the page surface, and print export.
 */
export function usePageLayout(): PageLayoutContextValue {
  const value = useContext(PageLayoutContext);
  if (!value) {
    throw new Error("usePageLayout() must be used within a <PageLayoutProvider>.");
  }
  return value;
}
