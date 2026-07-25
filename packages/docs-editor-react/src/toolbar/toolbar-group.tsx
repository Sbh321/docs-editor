import { useThemeClassName } from "../theme/use-theme";

import type { HTMLAttributes, ReactNode } from "react";

export interface ToolbarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** An accessible name for the group (sets `aria-label` on the `group` role). */
  readonly label?: string;
  readonly children?: ReactNode;
}

/**
 * Groups related toolbar controls under `role="group"` — e.g. the formatting
 * buttons apart from the block-style buttons. Presentational and optional;
 * applies the `"toolbarGroup"` theme class on top of any `className`.
 */
export function ToolbarGroup(props: ToolbarGroupProps): ReactNode {
  const { label, className, children, ...rest } = props;
  const themeClassName = useThemeClassName("toolbarGroup");

  return (
    <div
      role="group"
      {...(label !== undefined ? { "aria-label": label } : {})}
      className={[themeClassName, className].filter(Boolean).join(" ") || undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
