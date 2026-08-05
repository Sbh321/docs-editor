import { useContext } from "react";

import { ColorSchemeContext, useColorSchemeToggle, useSystemColorScheme } from "./color-scheme";

import type { ColorScheme, ColorSchemePreference } from "./color-scheme";

export interface UseColorSchemeResult {
  /** The scheme actually in effect — what is on screen right now. */
  readonly scheme: ColorScheme;
  /** What was asked for. `"system"` means "follow the operating system". */
  readonly preference: ColorSchemePreference;
  /** Sets the preference, or `undefined` when the provider controls it. */
  readonly setPreference: ((preference: ColorSchemePreference) => void) | undefined;
  /** Cycles light → dark → system. `undefined` when the provider controls it. */
  readonly toggle: (() => void) | undefined;
}

/**
 * The current colour scheme and a way to change it.
 *
 * Works without a `ThemeProvider`: it falls back to reading the operating
 * system directly, so a component can render correctly before an application
 * has adopted the provider — it simply cannot *change* the scheme in that case.
 *
 * ```tsx
 * const { scheme, preference, toggle } = useColorScheme();
 * <button onClick={toggle} disabled={!toggle}>
 *   {preference === "system" ? `Auto (${scheme})` : preference}
 * </button>
 * ```
 */
export function useColorScheme(): UseColorSchemeResult {
  const context = useContext(ColorSchemeContext);
  const systemScheme = useSystemColorScheme();

  // Hooks cannot be called conditionally, so the toggle is always built; when
  // there is a provider its values are used, otherwise the system fallback's.
  const preference = context?.preference ?? "system";
  const setPreference = context?.setPreference;
  const toggle = useColorSchemeToggle(preference, setPreference);

  return {
    scheme: context?.scheme ?? systemScheme,
    preference,
    setPreference,
    toggle: setPreference ? toggle : undefined,
  };
}
