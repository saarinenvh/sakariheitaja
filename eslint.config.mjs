// Flat config (ESLint 9+). Independent of the project's own module system
// (tsconfig.json targets CommonJS) - .mjs makes this file ESM regardless, which
// is what ESLint's own docs assume for flat config examples.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// The layer rules from the structure design (sakke-workspace docs/roadmap/sakariheitaja-structure)
// and docs/architecture/README.md.
const LAYER_RULE = "error";
const SOURCE_FILES = ["src/**/*.ts"];
// src/tests/ is test code throughout, including the integration tests' setup and helpers.
const TEST_FILES = ["**/*.test.ts", "src/tests/**"];

const noHttpOutsideIntegrations = {
  group: ["**/shared/http", "./http"],
  message: "HTTP belongs in an integration client (src/integrations/<system>/).",
};
const noTelegramFromBelow = {
  group: ["**/telegram/**"],
  message: "Only main.ts imports the Telegram layer; features send through ChatMessenger.",
};
const noUpwardImports = {
  group: ["**/features/**"],
  message: "shared/ and integrations/ sit below the features; they must not import them.",
};
// Another feature is reached through its public module, ../<feature> (its index.ts). The
// path is relative, so what names another feature depends on how deep the importing file
// sits: from src/features/<a>/<depth - 1 folders>/, "../" * depth is src/features/.
const INTERNALS_MESSAGE = "Import another feature through its public module (its index.ts), not its internals.";
const noFeatureInternalsByPath = {
  regex: "(^|/)features/[^/]+/(?!index$)",
  message: INTERNALS_MESSAGE,
};
const noOtherFeatureInternals = depth => ({
  regex: `^(\\.\\./){${depth}}[^./][^/]*/(?!index$)`,
  message: INTERNALS_MESSAGE,
});
const FEATURE_DEPTHS = [1, 2, 3];
const featureFilesAt = depth => [`src/features/${"*/".repeat(depth)}*.ts`];

// db/ lists the entities, which live with the features that own their tables.
const noUpwardImportsFromDb = {
  regex: "(^|/)features/(?!.*\\.entity$)",
  message: "db/ only lists the features' entities; it must not import anything else from them.",
};

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", ".eval-dist/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Off until the remaining `any`s in external response handling are typed.
      "@typescript-eslint/no-explicit-any": "off",

      // A prefixed underscore is the convention for an intentionally-unused
      // parameter.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/features/*.ts"],
    ignores: TEST_FILES,
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noTelegramFromBelow, noHttpOutsideIntegrations, noFeatureInternalsByPath] }] },
  },
  ...FEATURE_DEPTHS.map(depth => ({
    files: featureFilesAt(depth),
    ignores: TEST_FILES,
    rules: {
      "no-restricted-imports": [LAYER_RULE, {
        patterns: [noTelegramFromBelow, noHttpOutsideIntegrations, noFeatureInternalsByPath, noOtherFeatureInternals(depth)],
      }],
    },
  })),
  {
    files: ["src/shared/**/*.ts"],
    ignores: [...TEST_FILES, "src/shared/http.ts"],
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noTelegramFromBelow, noUpwardImports, noHttpOutsideIntegrations] }] },
  },
  {
    files: ["src/db/**/*.ts"],
    ignores: TEST_FILES,
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noTelegramFromBelow, noUpwardImportsFromDb, noHttpOutsideIntegrations] }] },
  },
  {
    files: ["src/telegram/**/*.ts", "src/main.ts"],
    ignores: TEST_FILES,
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noHttpOutsideIntegrations, noFeatureInternalsByPath] }] },
  },
  {
    files: ["src/integrations/**/*.ts"],
    ignores: TEST_FILES,
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noTelegramFromBelow, noUpwardImports] }] },
  },
  {
    files: SOURCE_FILES,
    ignores: [...TEST_FILES, "src/shared/http.ts", "src/integrations/**"],
    rules: {
      "no-restricted-globals": [LAYER_RULE, { name: "fetch", message: "HTTP belongs in an integration client (src/integrations/<system>/)." }],
    },
  },
  {
    files: SOURCE_FILES,
    ignores: [...TEST_FILES, "src/config.ts"],
    rules: {
      "no-restricted-properties": [LAYER_RULE, { object: "process", property: "env", message: "Read configuration through readConfig() in src/config.ts." }],
    },
  },
);
