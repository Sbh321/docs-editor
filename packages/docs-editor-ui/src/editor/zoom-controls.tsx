import { ZoomInIcon, ZoomOutIcon } from "@sbh321/docs-editor-icons";
import { useZoom } from "@sbh321/docs-editor-react";

import { Tooltip } from "../primitives/tooltip";

import type { ReactNode } from "react";

export interface ZoomControlsProps {
  readonly className?: string;
}

/**
 * The styled zoom group: zoom out, a percentage readout that resets, zoom in
 * (ROADMAP Phase 9 follow-up).
 *
 * The headless `ZoomControls` in `@sbh321/docs-editor-react` renders its own
 * buttons, which left them the last icon-only controls in the editor without
 * tooltips — `Tooltip` is this package's primitive, and a headless component
 * cannot reach up a layer for it. So this is the styled counterpart: the
 * *behaviour* still comes entirely from `useZoom` (the layering rule — this
 * package owns presentation, never behaviour), while the markup is ours to
 * wrap.
 *
 * The class names and accessible names deliberately match what the headless
 * component resolves through `editorTheme`, so swapping one for the other
 * changes nothing a stylesheet or a test can see.
 */
export function ZoomControls({ className }: ZoomControlsProps): ReactNode {
  const { zoom, min, max, zoomIn, zoomOut, reset } = useZoom();

  return (
    <div
      role="group"
      aria-label="Zoom"
      className={["de-zoom", className].filter(Boolean).join(" ")}
    >
      <Tooltip label="Zoom out">
        <button
          type="button"
          className="de-button de-button--ghost de-button--icon-sm"
          aria-label="Zoom out"
          disabled={zoom <= min}
          onClick={zoomOut}
        >
          <ZoomOutIcon />
        </button>
      </Tooltip>
      <Tooltip label="Reset zoom to 100%">
        <button
          type="button"
          className="de-button de-button--ghost de-zoom__label"
          aria-label="Reset zoom"
          onClick={reset}
        >
          {`${String(Math.round(zoom * 100))}%`}
        </button>
      </Tooltip>
      <Tooltip label="Zoom in">
        <button
          type="button"
          className="de-button de-button--ghost de-button--icon-sm"
          aria-label="Zoom in"
          disabled={zoom >= max}
          onClick={zoomIn}
        >
          <ZoomInIcon />
        </button>
      </Tooltip>
    </div>
  );
}
