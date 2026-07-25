import { useThemeClassName, useThemeIcon } from "../theme/use-theme";

import { useZoom } from "./use-zoom";

import type { CSSProperties, ReactNode } from "react";

export interface ZoomControlsProps {
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Formats the zoom readout. Defaults to a rounded percentage (e.g. `"120%"`). */
  readonly formatLabel?: (zoom: number) => ReactNode;
  /** An accessible name for the control group. Defaults to `"Zoom"`. */
  readonly label?: string;
}

/**
 * A headless zoom-out / readout / zoom-in control group backed by
 * `ZoomProvider`. Must be rendered within one. Buttons disable at the min/max
 * bounds and pull `zoomOut`/`zoomIn` icons from the theme when available.
 * Style it via `className` or the `"zoom*"` theme classes.
 */
export function ZoomControls(props: ZoomControlsProps): ReactNode {
  const { className, style, formatLabel, label } = props;
  const { zoom, min, max, zoomIn, zoomOut, reset } = useZoom();

  const groupClassName = useThemeClassName("zoomControls");
  const buttonClassName = useThemeClassName("zoomButton");
  const labelClassName = useThemeClassName("zoomLabel");
  const zoomInIcon = useThemeIcon("zoomIn");
  const zoomOutIcon = useThemeIcon("zoomOut");

  const readout = formatLabel ? formatLabel(zoom) : `${Math.round(zoom * 100)}%`;

  return (
    <div
      role="group"
      aria-label={label ?? "Zoom"}
      className={[groupClassName, className].filter(Boolean).join(" ") || undefined}
      style={style}
    >
      <button
        type="button"
        className={buttonClassName}
        aria-label="Zoom out"
        disabled={zoom <= min}
        onClick={zoomOut}
      >
        {zoomOutIcon ?? "−"}
      </button>
      <button type="button" className={labelClassName} aria-label="Reset zoom" onClick={reset}>
        {readout}
      </button>
      <button
        type="button"
        className={buttonClassName}
        aria-label="Zoom in"
        disabled={zoom >= max}
        onClick={zoomIn}
      >
        {zoomInIcon ?? "+"}
      </button>
    </div>
  );
}
