import { useContext } from "react";

import { ZoomContext } from "./zoom-context";

import type { ZoomContextValue } from "./zoom-context";

/**
 * Reads the current zoom state and controls from the nearest `ZoomProvider`.
 * Throws when used outside one — zoom needs shared state between the controls
 * and the editor, which only a provider can supply.
 */
export function useZoom(): ZoomContextValue {
  const value = useContext(ZoomContext);
  if (!value) {
    throw new Error("useZoom() must be used within a <ZoomProvider>.");
  }
  return value;
}
