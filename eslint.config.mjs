import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";

export default [
  {
    ...nextPlugin.configs["core-web-vitals"],
    plugins: {
      ...nextPlugin.configs["core-web-vitals"].plugins,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      // Downgraded to warnings — 48 instances of <a> that should be <Link />.
      // Fix incrementally; do not re-upgrade to "error" until all instances are resolved.
      "@next/next/no-html-link-for-pages": "warn",
      // Downgraded to warnings — 33 instances of missing useEffect/useCallback deps.
      // Fix incrementally; do not re-upgrade to "error" until all instances are resolved.
      "react-hooks/exhaustive-deps": "warn",
      // Downgraded to warnings — 2 autoFocus instances.
      "jsx-a11y/no-autofocus": "warn",
    },
  },
];
