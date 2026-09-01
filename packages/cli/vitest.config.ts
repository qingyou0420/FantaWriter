import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // CLI integration tests spawn real child processes; the default 5s timeout
    // is too aggressive when the whole workspace runs in parallel.
    testTimeout: 60_000,
  },
});
