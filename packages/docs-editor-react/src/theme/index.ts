export { ThemeProvider, COLOR_SCHEME_ATTRIBUTE } from "./theme-provider";
export { renderThemeIcon, useTheme, useThemeClassName, useThemeIcon } from "./use-theme";
export { useColorScheme } from "./use-color-scheme";
export {
  nextColorSchemePreference,
  resolveColorScheme,
  useSystemColorScheme,
} from "./color-scheme";

export type { ThemeProviderProps } from "./theme-provider";
export type { EditorTheme, ThemeIcon } from "./theme-context";
export type { ColorScheme, ColorSchemePreference } from "./color-scheme";
export type { UseColorSchemeResult } from "./use-color-scheme";
