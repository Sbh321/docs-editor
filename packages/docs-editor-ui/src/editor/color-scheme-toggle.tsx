import { ToolbarButton, ToolbarGroup, useColorScheme } from "@sbh321/docs-editor-react";

import { Tooltip } from "../primitives/tooltip";

import type { ReactNode } from "react";

const SUN_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" aria-hidden>
    <circle cx="8" cy="8" r="3.25" strokeWidth="1.5" />
    <path
      d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06M12.95 12.95l-1.06-1.06M4.11 4.11L3.05 3.05"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const MOON_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" aria-hidden>
    <path
      d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7Z"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** Half sun, half moon — the conventional "follow the system" mark. */
const AUTO_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
    <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" />
  </svg>
);

/**
 * The toolbar's light/dark control — cycles light → dark → follow-the-system.
 *
 * Icon-led rather than a bare word. This shipped first as a text button reading
 * "Auto", which nobody recognised as a theme control — the first question asked
 * about it was where the button *was*, while looking straight at it.
 *
 * ## When it disappears
 *
 * It renders **nothing** when the colour scheme is controlled from outside and
 * no change handler was given, because in that case there is nothing it could
 * do: `useColorScheme` reports `toggle: undefined` rather than handing back a
 * function that silently fails. An application that controls the scheme and
 * still wants a toolbar control passes `onColorSchemeChange` and gets this one
 * back, or supplies its own through the `"colorScheme"` slot.
 */
export function ColorSchemeToggle(): ReactNode {
  const { scheme, preference, toggle } = useColorScheme();
  if (!toggle) {
    return null;
  }

  // The *resolved* scheme is in the name too, so "Auto" says which way it
  // currently resolves rather than leaving the user to guess.
  const label = preference === "system" ? `Theme: auto (${scheme})` : `Theme: ${preference}`;
  const icon = preference === "system" ? AUTO_ICON : preference === "dark" ? MOON_ICON : SUN_ICON;

  return (
    <ToolbarGroup label="Appearance">
      <Tooltip label={`${label} — click to change`}>
        <ToolbarButton onClick={toggle} label={label} icon={icon} />
      </Tooltip>
    </ToolbarGroup>
  );
}
