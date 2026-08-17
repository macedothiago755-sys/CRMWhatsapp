import { defineConfig } from "vitest/config";

/**
 * Unit tests only — no external dependencies required. See
 * vitest.integration.config.ts for the suite that needs a live Postgres.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
