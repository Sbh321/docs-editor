import { useMemo } from "react";

import { ThemeContext } from "./theme-context";

import type { EditorTheme } from "./theme-context";
import type { CSSProperties, ReactNode } from "react";

export interface ThemeProviderProps extends EditorTheme {
  /**
   * A whole theme object. Merged under the individual `classNames`/`icons`/
   * `tokens` props, so either style of configuration works and the individual
   * props win on conflict.
   */
  readonly theme?: EditorTheme;
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
 * Supplies an {@link EditorTheme} to the headless UI components below it and
 * exposes the theme's design tokens as CSS custom properties on its wrapper
 * element. Entirely optional — components work without it — and it carries
 * presentation only, never behavior.
 */
export function ThemeProvider(props: ThemeProviderProps): ReactNode {
  const { theme, className, style, children, classNames, icons, tokens } = props;

  const value = useMemo<EditorTheme>(
    () => ({
      classNames: { ...theme?.classNames, ...classNames },
      icons: { ...theme?.icons, ...icons },
      tokens: { ...theme?.tokens, ...tokens },
    }),
    [theme, classNames, icons, tokens],
  );

  const wrapperStyle = useMemo<CSSProperties>(
    () => ({ ...tokensToCustomProperties(value.tokens), ...style }),
    [value.tokens, style],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className={className} style={wrapperStyle}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
