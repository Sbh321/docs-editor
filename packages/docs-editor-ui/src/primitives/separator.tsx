import { cn } from "../class-names";

import type { HTMLAttributes, ReactNode } from "react";

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  readonly orientation?: "horizontal" | "vertical";
  /**
   * Whether the separator carries meaning. Defaults to `false` — a rule between
   * toolbar groups is a visual grouping cue that a screen reader should skip,
   * and announcing every one of them is noise.
   */
  readonly semantic?: boolean;
}

/** A hairline between groups of controls. */
export function Separator({
  orientation = "horizontal",
  semantic = false,
  className,
  ...rest
}: SeparatorProps): ReactNode {
  return (
    <div
      className={cn("de-separator", `de-separator--${orientation}`, className)}
      {...(semantic
        ? { role: "separator", "aria-orientation": orientation }
        : { role: "none", "aria-hidden": true })}
      {...rest}
    />
  );
}
