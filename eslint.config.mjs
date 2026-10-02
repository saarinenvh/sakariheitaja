// Flat config (ESLint 9+). Independent of the project's own module system
// (tsconfig.json targets CommonJS) - .mjs makes this file ESM regardless, which
// is what ESLint's own docs assume for flat config examples.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// The layer rules from the structure design (sakke-workspace docs/roadmap/sakariheitaja-structure).
// They warn while the restructure moves code into place, and become errors when it's done.
const LAYER_RULE = "warn";
const SOURCE_FILES = ["src/**/*.ts"];
const TEST_FILES = ["**/*.test.ts"];

const noHttpOutsideIntegrations = {
  group: ["**/shared/http", "./http"],
  message: "HTTP belongs in an integration client (src/integrations/<system>/).",
};
const noBotFromBelow = {
  group: ["**/bot/*"],
  message: "Only the Telegram layer imports the bot; features send through ChatMessenger.",
};
const noUpwardImports = {
  group: ["**/features/**", "**/config/*"],
  message: "shared/ and db/ sit below the features and UI text; they must not import them.",
};
// db/ lists the entities, which live with the features that own their tables.
const noUpwardImportsFromDb = {
  regex: "(^|/)(features/(?!.*\\.entity$)|config/)",
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
    files: ["src/features/**/*.ts"],
    ignores: TEST_FILES,
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noBotFromBelow, noHttpOutsideIntegrations] }] },
  },
  {
    files: ["src/shared/**/*.ts"],
    ignores: [...TEST_FILES, "src/shared/http.ts"],
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noBotFromBelow, noUpwardImports, noHttpOutsideIntegrations] }] },
  },
  {
    files: ["src/db/**/*.ts"],
    ignores: TEST_FILES,
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noBotFromBelow, noUpwardImportsFromDb, noHttpOutsideIntegrations] }] },
  },
  {
    files: ["src/bot/**/*.ts"],
    ignores: TEST_FILES,
    rules: { "no-restricted-imports": [LAYER_RULE, { patterns: [noHttpOutsideIntegrations] }] },
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
