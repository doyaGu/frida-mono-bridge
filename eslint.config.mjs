import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript specific
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_|^error$|^e$",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-namespace": "off", // Used for type grouping
      "@typescript-eslint/no-require-imports": "off", // Dynamic imports needed

      // General
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-case-declarations": "off", // Allow declarations in case blocks
      "no-loss-of-precision": "warn", // Downgrade to warning
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "data/**", "scripts/**", "**/*.js", "eslint.config.mjs"],
  },
);
