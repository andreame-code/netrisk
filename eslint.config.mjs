import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const lintedFiles = [
  "backend/**/*.{ts,cts,mts}",
  "frontend/src/**/*.{ts,cts,mts,d.ts}",
  "frontend/react-shell/**/*.{ts,tsx,d.ts}",
  "shared/**/*.{ts,cts,mts,d.ts}",
  "scripts/**/*.{ts,cts,mts}",
  "tests/**/*.{ts,cts,mts,d.ts}",
  "api/**/*.{ts,cts,mts,d.ts}",
  "supabase/**/*.{ts,cts,mts,d.ts}"
];

const typeCheckedFiles = [
  "backend/**/*.{ts,cts,mts}",
  "frontend/src/**/*.{ts,cts,mts}",
  "frontend/react-shell/**/*.{ts,tsx}",
  "shared/**/*.{ts,cts,mts}",
  "scripts/**/*.{ts,cts,mts}",
  "tests/**/*.{ts,cts,mts}",
  "api/**/*.{ts,cts,mts}",
  "supabase/**/*.{ts,cts,mts}"
];

const nodeFiles = [
  "backend/**/*.{ts,cts,mts}",
  "frontend/react-shell/vite.config.ts",
  "shared/**/*.{ts,cts,mts,d.ts}",
  "scripts/**/*.{ts,cts,mts}",
  "tests/**/*.{ts,cts,mts,d.ts}",
  "api/**/*.{ts,cts,mts,d.ts}",
  "supabase/**/*.{ts,cts,mts,d.ts}"
];

const browserFiles = [
  "frontend/src/**/*.{ts,cts,mts,d.ts}",
  "frontend/react-shell/src/**/*.{ts,tsx,d.ts}"
];

export default [
  {
    ignores: [
      ".git/**",
      ".tsbuild/**",
      "coverage/**",
      "data/**",
      "frontend/assets/**",
      "node_modules/**",
      "playwright-report/**",
      "public/**",
      "test-results/**"
    ]
  },
  ...[js.configs.recommended, ...tseslint.configs.recommended].map((config) => ({
    ...config,
    files: lintedFiles
  })),
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typeCheckedFiles,
    ignores: ["**/*.d.ts"]
  })),
  {
    files: typeCheckedFiles,
    ignores: ["**/*.d.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.frontend.json", "./tsconfig.react-shell.json"],
        tsconfigRootDir: rootDir
      }
    },
    rules: {
      "no-empty": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-useless-assignment": "warn",
      "no-useless-catch": "warn",
      "no-useless-escape": "warn",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false
          }
        }
      ],
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/unbound-method": "off"
    }
  },
  {
    files: browserFiles,
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
  eslintConfigPrettier
];
