import { createContext } from "react";

import type { RefObject } from "react";

export type ToolbarOrientation = "horizontal" | "vertical";

/**
 * The roving-tabindex coordination a `Toolbar` shares with its buttons. A
 * toolbar is a single tab stop (WAI-ARIA authoring practice); arrow keys move
 * focus between buttons, so exactly one button is tabbable (`tabIndex 0`) at a
 * time and the rest are `-1`.
 */
export interface ToolbarContextValue {
  readonly orientation: ToolbarOrientation;
  /** Registers a focusable button; returns an unregister callback. */
  readonly register: (id: string, ref: RefObject<HTMLElement | null>) => () => void;
  /** The `tabIndex` a button with `id` should use (0 for the current tab stop, else -1). */
  readonly tabIndexFor: (id: string) => 0 | -1;
  /** Notifies the toolbar that `id` received focus, making it the tab stop. */
  readonly onItemFocus: (id: string) => void;
}

export const ToolbarContext = createContext<ToolbarContextValue | null>(null);
