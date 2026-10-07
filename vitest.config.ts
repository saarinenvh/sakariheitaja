import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // They need Docker; `npm run test:integration` runs them (vitest.integration.config.ts).
    exclude: ["src/tests/integration/**", "**/node_modules/**"],
  },
});
