import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Allow unused vars prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Relax some rules for development
      "@typescript-eslint/no-explicit-any": "warn",
      // These new rules are too strict for common React patterns
      // Async data fetching in useEffect that sets state is standard practice
      "react-hooks/set-state-in-effect": "off",
      // Defining components inside render is fine for simple cases
      "react-hooks/static-components": "warn",
      // Variable hoisting check - function declarations are hoisted
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
