import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
    },
    rules: {
      "no-control-regex": "off",
    },
  },
  {
    files: ["public/app.js"],
    languageOptions: {
      globals: { ...globals.browser },
      sourceType: "script",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
  {
    files: ["server.js"],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: "module",
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: "module",
    },
  },
  {
    ignores: ["node_modules/", "dist/", "coverage/"],
  },
];
