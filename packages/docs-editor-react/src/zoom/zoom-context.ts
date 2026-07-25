import { createContext } from "react";

import type { CSSProperties } from "react";

/**
 * Zoom is transient UI state — it belongs to the adapter, never to the
 * document model (per ARCHITECTURE.md's State Architecture). This context
 * carries the current zoom factor and the controls to change it.
 */
export interface ZoomContextValue {
  /** The current zoom factor (`1` is 100%). */
  readonly zoom: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Sets the zoom factor, clamped to `[min, max]`. */
  readonly setZoom: (zoom: number) => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  /** Resets to 100%. */
  readonly reset: () => void;
  /**
   * A style applying the current zoom as a CSS transform. Spread onto the
   * `<Editor style={…} />` (or a wrapper) to render at the chosen scale.
   */
  readonly editorStyle: CSSProperties;
}

export const ZoomContext = createContext<ZoomContextValue | null>(null);
