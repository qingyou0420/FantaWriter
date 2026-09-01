import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    // Some pipeline-runner tests can approach Vitest's default 5s timeout
    // under full parallel runs; keep this high enough to avoid false kills.
    testTimeout: 30_000,
  },
});
