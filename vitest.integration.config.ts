import { defineConfig } from "vitest/config";

// Tests against a real MariaDB in Docker (Testcontainers): `npm run test:integration`.
export default defineConfig({
  test: {
    include: ["src/tests/integration/**/*.test.ts"],
    globalSetup: ["src/tests/integration/globalSetup.ts"],
    // One database for the run, so the files take turns with it.
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
