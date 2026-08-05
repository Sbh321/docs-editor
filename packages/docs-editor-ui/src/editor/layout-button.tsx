import { ToolbarButton, ToolbarGroup } from "@sbh321/docs-editor-react";

import { Tooltip } from "../primitives/tooltip";

import type { ReactNode } from "react";

export interface LayoutButtonProps {
  /** Whether the layout panel is open — rendered as the button's pressed state. */
  readonly pressed: boolean;
  readonly onToggle: () => void;
  /** Accessible name. Defaults to `"Layout"`. */
  readonly label?: string;
}

/**
 * Opens and closes the layout panel.
 *
 * A **toggle**, not an action: it carries `aria-pressed`, so the panel's state
 * is readable from the button rather than only from whether a panel happens to
 * be visible. That matters most for the case it is easy to get wrong — a
 * screen-reader user, who cannot see the panel appear.
 *
 * The glyph comes from the theme's `"pageLayout"` intent, as every other button
 * in this package does, so an application swapping in its own icon set gets a
 * consistent toolbar rather than one button drawn in a foreign hand.
 */
export function LayoutButton({
  pressed,
  onToggle,
  label = "Layout",
}: LayoutButtonProps): ReactNode {
  return (
    <ToolbarGroup label="Panels">
      <Tooltip label={label}>
        <ToolbarButton active={pressed} onClick={onToggle} label={label} iconName="pageLayout" />
      </Tooltip>
    </ToolbarGroup>
  );
}
