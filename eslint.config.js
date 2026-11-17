import tsesparser from "@typescript-eslint/parser";
import tsplugin from "@typescript-eslint/eslint-plugin";
import eslintPluginPrettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsesparser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": tsplugin,
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...tsplugin.configs["flat/base"].rules,
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "no-console": "off",
      "no-empty": "off",
    },
  },
  eslintConfigPrettier,
];
