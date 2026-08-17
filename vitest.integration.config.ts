import { defineConfig } from "vitest/config";

/**
 * Integration tests — require DATABASE_URL pointing at a real (or ephemeral,
 * containerized) Postgres with migrations applied. See tests/integration/README.md.
 * Run sequentially (fileParallelism: false) since tests share one database and
 * some assert on row counts.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
  },
});
