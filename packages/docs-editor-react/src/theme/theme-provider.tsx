import { useCallback, useEffect, useMemo, useState } from "react";

import { ColorSchemeContext, resolveColorScheme, useSystemColorScheme } from "./color-scheme";
import { ThemeContext } from "./theme-context";

import type { ColorSchemeContextValue, ColorSchemePreference } from "./color-scheme";
import type { EditorTheme } from "./theme-context";
import type { CSSProperties, ReactNode } from "react";

/**
 * The attribute the stylesheet keys its light/dark overrides off. Namespaced so
 * it cannot collide with an application's own theming attribute.
 */
export const COLOR_SCHEME_ATTRIBUTE = "data-docs-editor-theme";

export interface ThemeProviderProps extends EditorTheme {
  /**
   * A whole theme object. Merged under the individual `classNames`/`icons`/
   * `tokens` props, so either style of configuration works and the individual
   * props win on conflict.
   */
  readonly theme?: EditorTheme;
  /**
   * Controls the colour scheme. Pass `"system"` (the default) to follow the
   * operating system, or a fixed scheme to override it in either direction.
   *
   * Supplying this makes the provider **controlled**: pair it with
   * `onColorSchemeChange` to keep a toggle working, or `useColorScheme`'s
   * `setPreference` will be `undefined` so a control can disable itself rather
   * than call something that silently does nothing.
   */
  readonly colorScheme?: ColorSchemePreference;
  /** Initial preference when uncontrolled. Defaults to `"system"`. */
  readonly defaultColorScheme?: ColorSchemePreference;
  /** Notified whenever the preference changes — for persisting it. */
  readonly onColorSchemeChange?: (preference: ColorSchemePreference) => void;
  /**
   * Also set the scheme attribute on `<html>`. Off by default, since a provider
   * wrapping part of a page should not restyle the whole document — turn it on
   * when the editor *is* the page, so the body background matches and
   * overscroll does not reveal a white gap behind a dark editor.
   */
  readonly applyToDocument?: boolean;
  /** Class name for the wrapper element the provider renders. */
  readonly className?: string;
  /** Inline styles for the wrapper element, merged after the token custom properties. */
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

/** Turns `{ accent: "#0b5" }` into `{ "--accent": "#0b5" }`, leaving `--`-prefixed keys as-is. */
function tokensToCustomProperties(
  tokens: Readonly<Record<string, string>> | undefined,
): CSSProperties {
  if (!tokens) {
    return {};
  }
  const style: CSSProperties = {};
  for (const [key, value] of Object.entries(tokens)) {
    (style as Record<string, string>)[key.startsWith("--") ? key : `--${key}`] = value;
  }
  return style;
}

/**
 * Supplies an {@link EditorTheme} to the headless UI components below it,
 * exposes the theme's design tokens as CSS custom properties on its wrapper
 * element, and resolves the light/dark colour scheme.
 *
 * Entirely optional — components work without it — and it carries presentation
 * only, never behavior.
 */
export function ThemeProvider(props: ThemeProviderProps): ReactNode {
  const {
    theme,
    className,
    style,
    children,
    classNames,
    icons,
    tokens,
    colorScheme,
    defaultColorScheme = "system",
    onColorSchemeChange,
    applyToDocument = false,
  } = props;

  const value = useMemo<EditorTheme>(
    () => ({
      classNames: { ...theme?.classNames, ...classNames },
      icons: { ...theme?.icons, ...icons },
      tokens: { ...theme?.tokens, ...tokens },
    }),
    [theme, classNames, icons, tokens],
  );

  const [uncontrolled, setUncontrolled] = useState<ColorSchemePreference>(defaultColorScheme);
  const isControlled = colorScheme !== undefined;
  const preference = colorScheme ?? uncontrolled;

  const systemScheme = useSystemColorScheme();
  const scheme = resolveColorScheme(preference, systemScheme);

  const setPreference = useCallback(
    (next: ColorSchemePreference) => {
      if (!isControlled) {
        setUncontrolled(next);
      }
      onColorSchemeChange?.(next);
    },
    [isControlled, onColorSchemeChange],
  );

  useEffect(() => {
    if (!applyToDocument || typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const previous = root.getAttribute(COLOR_SCHEME_ATTRIBUTE);

    if (preference === "system") {
      root.removeAttribute(COLOR_SCHEME_ATTRIBUTE);
    } else {
      root.setAttribute(COLOR_SCHEME_ATTRIBUTE, preference);
    }

    return () => {
      // Restore rather than blindly remove, so unmounting one provider does not
      // clobber a scheme another part of the application set.
      if (previous === null) {
        root.removeAttribute(COLOR_SCHEME_ATTRIBUTE);
      } else {
        root.setAttribute(COLOR_SCHEME_ATTRIBUTE, previous);
      }
    };
  }, [applyToDocument, preference]);

  const colorSchemeValue = useMemo<ColorSchemeContextValue>(
    () => ({
      scheme,
      preference,
      // A controlled provider with no change handler cannot honour a request,
      // so it reports that instead of accepting one and doing nothing.
      setPreference: isControlled && !onColorSchemeChange ? undefined : setPreference,
    }),
    [scheme, preference, isControlled, onColorSchemeChange, setPreference],
  );

  const wrapperStyle = useMemo<CSSProperties>(
    () => ({ ...tokensToCustomProperties(value.tokens), ...style }),
    [value.tokens, style],
  );

  // The attribute is *omitted* when following the system, not set to "system".
  // The stylesheet's base rule matches `[data-docs-editor-theme]`, so a literal
  // "system" would pin the wrapper to light tokens and defeat the media query.
  const schemeAttribute = preference === "system" ? undefined : preference;

  return (
    <ThemeContext.Provider value={value}>
      <ColorSchemeContext.Provider value={colorSchemeValue}>
        <div
          className={className}
          style={wrapperStyle}
          {...(schemeAttribute ? { [COLOR_SCHEME_ATTRIBUTE]: schemeAttribute } : {})}
        >
          {children}
        </div>
      </ColorSchemeContext.Provider>
    </ThemeContext.Provider>
  );
}
