import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * React-only additions (react-hooks, jsx-a11y, browser globals). Does not
 * include the shared base config — consumers compose this on top of
 * `baseConfig` themselves, scoped to the paths that actually render React.
 * @type {import("eslint").Linter.Config[]}
 */
export const reactConfig = [
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];

export default reactConfig;
