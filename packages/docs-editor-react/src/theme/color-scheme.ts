/**
 * Colour-scheme resolution (ROADMAP Phase 8, Milestone 8.2).
 *
 * This is *state*, not styling: which scheme is in effect, and how a consumer
 * changes it. The values it resolves to are supplied by the stylesheet, so this
 * stays in the headless adapter while the palette lives in the styled package.
 *
 * The rule it implements: the operating system's preference is the default, and
 * an explicit choice overrides it **in both directions**. "Follow my system" and
 * "give me dark even though my OS is light" are both things people want, and a
 * design that only supports the first is the common bug.
 */

import { createContext, useCallback, useSyncExternalStore } from "react";

/** A resolved colour scheme — what is actually being rendered. */
export type ColorScheme = "light" | "dark";

/**
 * What the user asked for. `"system"` is not a scheme but a *deferral*, which is
 * why it is a separate type from {@link ColorScheme}: code that renders needs
 * the resolved answer, and code that offers a control needs the preference.
 */
export type ColorSchemePreference = ColorScheme | "system";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Subscribes to changes in the operating system's colour-scheme preference. */
function subscribeToSystemScheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function readSystemScheme(): ColorScheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/**
 * The operating system's current colour-scheme preference, kept up to date as
 * the user changes it — so an editor open while the OS switches to dark at
 * sunset follows along rather than waiting for a reload.
 *
 * Returns `"light"` during server rendering, where there is no preference to
 * read. That matches the CSS, whose dark rules live inside a media query the
 * server also cannot evaluate.
 */
export function useSystemColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeToSystemScheme, readSystemScheme, () => "light");
}

/** Resolves a preference against the system scheme. */
export function resolveColorScheme(
  preference: ColorSchemePreference,
  systemScheme: ColorScheme,
): ColorScheme {
  return preference === "system" ? systemScheme : preference;
}

export interface ColorSchemeContextValue {
  /** The scheme actually in effect. */
  readonly scheme: ColorScheme;
  /** What was asked for — `"system"` when following the operating system. */
  readonly preference: ColorSchemePreference;
  /**
   * Changes the preference. `undefined` when the provider was given a
   * controlled `colorScheme` prop and no `onColorSchemeChange`, since there is
   * nothing this layer can do about it — a control should disable itself rather
   * than call a function that silently does nothing.
   */
  readonly setPreference: ((preference: ColorSchemePreference) => void) | undefined;
}

export const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

/** Cycles light → dark → system, the order a three-state toggle reads best in. */
export function nextColorSchemePreference(
  preference: ColorSchemePreference,
): ColorSchemePreference {
  if (preference === "light") {
    return "dark";
  }
  return preference === "dark" ? "system" : "light";
}

/**
 * Builds the `toggle` helper exposed by `useColorScheme`, memoised so a control
 * bound to it does not re-render on every parent render.
 */
export function useColorSchemeToggle(
  preference: ColorSchemePreference,
  setPreference: ((preference: ColorSchemePreference) => void) | undefined,
): (() => void) | undefined {
  return useCallback(() => {
    setPreference?.(nextColorSchemePreference(preference));
  }, [preference, setPreference]);
}
