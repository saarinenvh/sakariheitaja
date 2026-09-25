// Flat config (ESLint 9+). Independent of the project's own module system
// (tsconfig.json targets CommonJS) - .mjs makes this file ESM regardless, which
// is what ESLint's own docs assume for flat config examples.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CLAUDE.md states "Prefer explicit types over any" as a coding
      // guideline, and the honest tension is that this codebase doesn't
      // follow it yet: 24 existing `any`s across 14 files as of 2026-09-25
      // (external API response shapes in shared/http.ts, challonge.ts,
      // giphy.ts, ollamaClient.ts; logger formatting). Off for this first
      // lint rollout rather than blocking adoption on an unplanned typing
      // pass - but unlike the gateway's equivalent decision, this one
      // contradicts a documented project guideline rather than just being
      // silent on the subject, so it's worth resolving deliberately rather
      // than leaving indefinitely.
      "@typescript-eslint/no-explicit-any": "off",

      // A prefixed underscore is the convention for an intentionally-unused
      // parameter.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
