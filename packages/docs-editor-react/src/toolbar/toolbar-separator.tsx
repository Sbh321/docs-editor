import { useContext } from "react";

import { useThemeClassName } from "../theme/use-theme";

import { ToolbarContext } from "./toolbar-context";

import type { HTMLAttributes, ReactNode } from "react";

export type ToolbarSeparatorProps = HTMLAttributes<HTMLDivElement>;

/**
 * A visual/semantic divider between toolbar groups (`role="separator"` with the
 * correct `aria-orientation` — perpendicular to the toolbar). Applies the
 * `"toolbarSeparator"` theme class; render it however you like.
 */
export function ToolbarSeparator(props: ToolbarSeparatorProps): ReactNode {
  const { className, ...rest } = props;
  const toolbar = useContext(ToolbarContext);
  const themeClassName = useThemeClassName("toolbarSeparator");
  // A separator's own orientation is perpendicular to the toolbar's flow.
  const orientation = toolbar?.orientation === "vertical" ? "horizontal" : "vertical";

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={[themeClassName, className].filter(Boolean).join(" ") || undefined}
      {...rest}
    />
  );
}
