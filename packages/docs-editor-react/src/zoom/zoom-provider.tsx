import { useCallback, useMemo, useState } from "react";

import { ZoomContext } from "./zoom-context";

import type { ZoomContextValue } from "./zoom-context";
import type { ReactNode } from "react";

export interface ZoomProviderProps {
  /** Initial zoom factor (`1` is 100%). Defaults to `1`. */
  readonly initialZoom?: number;
  /** Minimum zoom factor. Defaults to `0.5`. */
  readonly min?: number;
  /** Maximum zoom factor. Defaults to `2`. */
  readonly max?: number;
  /** Step applied by `zoomIn`/`zoomOut`. Defaults to `0.1`. */
  readonly step?: number;
  readonly children?: ReactNode;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Holds zoom state for the controls and editor below it. Provides the current
 * factor, the change controls, and an `editorStyle` to apply the scale —
 * transient UI state, kept out of the document model.
 */
export function ZoomProvider(props: ZoomProviderProps): ReactNode {
  const { initialZoom = 1, min = 0.5, max = 2, step = 0.1, children } = props;
  const [zoom, setZoomState] = useState(() => clamp(initialZoom, min, max));

  const setZoom = useCallback((value: number) => setZoomState(clamp(value, min, max)), [min, max]);
  const zoomIn = useCallback(
    () => setZoomState((z) => clamp(z + step, min, max)),
    [min, max, step],
  );
  const zoomOut = useCallback(
    () => setZoomState((z) => clamp(z - step, min, max)),
    [min, max, step],
  );
  const reset = useCallback(() => setZoomState(clamp(1, min, max)), [min, max]);

  const value = useMemo<ZoomContextValue>(
    () => ({
      zoom,
      min,
      max,
      step,
      setZoom,
      zoomIn,
      zoomOut,
      reset,
      // `transform: scale` keeps the editor in normal document flow better than
      // the non-standard `zoom` property and animates smoothly; the top-left
      // origin keeps the content anchored as it scales.
      editorStyle: { transform: `scale(${zoom})`, transformOrigin: "top left" },
    }),
    [zoom, min, max, step, setZoom, zoomIn, zoomOut, reset],
  );

  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
}
