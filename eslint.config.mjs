import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.cjs", "scripts/**"],
    rules: {
      // Electron / 打包脚本是 CommonJS，require 是对的
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
