import { isValidElement, useContext } from "react";

import { ThemeContext } from "./theme-context";

import type { EditorTheme, ThemeIcon } from "./theme-context";
import type { ReactNode } from "react";

const EMPTY_THEME: EditorTheme = {};

/**
 * The nearest {@link EditorTheme}, or an empty theme when there's no
 * `ThemeProvider` above — components read this and degrade to unstyled,
 * icon-free rendering rather than requiring a provider.
 */
export function useTheme(): EditorTheme {
  return useContext(ThemeContext) ?? EMPTY_THEME;
}

/** Resolves the theme class name for `slot`, or `undefined` when none is set. */
export function useThemeClassName(slot: string): string | undefined {
  return useTheme().classNames?.[slot];
}

/** Renders `icon` — whether it's a node or a component — to a `ReactNode`. */
export function renderThemeIcon(icon: ThemeIcon | undefined): ReactNode {
  if (icon === undefined || icon === null || icon === false) {
    return null;
  }
  if (typeof icon === "function") {
    const IconComponent = icon;
    return <IconComponent />;
  }
  return isValidElement(icon) ? icon : (icon as ReactNode);
}

/** Resolves and renders the theme icon registered under `name`, or `null`. */
export function useThemeIcon(name: string | undefined): ReactNode {
  const icons = useTheme().icons;
  if (!name || !icons) {
    return null;
  }
  return renderThemeIcon(icons[name]);
}
