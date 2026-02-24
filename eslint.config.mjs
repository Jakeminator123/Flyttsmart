import tseslint from "typescript-eslint";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "data/**",
      "adressandring/**",
      "drizzle/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      ...tseslint.configs.recommended,
    ],
    plugins: {
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-img-element": "warn",

      "prefer-const": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);
