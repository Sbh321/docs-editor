import { cn } from "../class-names";

import type { HTMLAttributes, ReactNode } from "react";

export interface ToolbarSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a bottom border, for a bar sitting above content. */
  readonly bordered?: boolean;
}

/**
 * The raised surface a toolbar sits on.
 *
 * Separate from the headless `Toolbar` (which owns roving focus and the
 * `toolbar` role) so styling and behaviour stay in their own layers: this
 * paints, that one navigates.
 */
export function ToolbarSurface({
  bordered = true,
  className,
  children,
  ...rest
}: ToolbarSurfaceProps): ReactNode {
  return (
    <div
      className={cn("de-toolbar-surface", bordered && "de-toolbar-surface--bordered", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
