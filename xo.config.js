"use strict";

const globals = require("globals");
const { defineConfig } = require("eslint/config");
const compatPlugin = require("eslint-plugin-compat");

module.exports = defineConfig([
  {
    extends: [compatPlugin.configs["flat/recommended"]],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.jquery,
      },
    },
    prettier: true,
    space: 2,
    ignores: ["**/vendor/**"],
    rules: {
      "@stylistic/spaced-comment": "off",
      camelcase: [
        "error",
        {
          properties: "never",
        },
      ],
      "capitalized-comments": "off",
      "new-cap": [
        "error",
        {
          properties: false,
        },
      ],
      "no-alert": "off",
      "no-console": "error",
      // This should be removed later
      "no-implicit-globals": "off",
      "no-negated-condition": "off",
      "promise/prefer-await-to-then": "off",
      "prefer-arrow-callback": "error",
      "prefer-destructuring": [
        // This should be enabled later
        "off",
        {
          object: true,
          array: false,
        },
      ],
      // This should be reverted to "error" later
      strict: ["error", "global"],
      // Require u flag instead of v: WebKit (Safari, DuckDuckGo) does not yet
      // support the ES2024 v (Unicode Sets) flag, causing a SyntaxError that
      // prevents all JS from executing. None of our regexes use v-exclusive
      // features, so u is fully equivalent and broadly compatible.
      "require-unicode-regexp": ["error", { requireFlag: "u" }],
      "unicorn/no-anonymous-default-export": "off",
      "unicorn/no-document-cookie": "off",
      "unicorn/no-negated-condition": "off",
      "unicorn/prefer-module": "off",
      "unicorn/prefer-query-selector": "off",
      "unicorn/prefer-string-slice": "off",
      "unicorn/prefer-string-raw": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/switch-case-braces": "off",
    },
  },
  {
    // Unlike scripts/js/*.js (classic browser scripts, sourceType: "script"
    // above), test/**/*.js and the vitest config are Node ESM: they use
    // import/export and run under Node (via vitest), not loaded as a
    // browser <script>.
    files: ["test/**/*.js", "vitest.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // ESM files don't carry (and don't need) a "use strict" pragma.
      strict: "off",
      // Tests load classic scripts.js source via vm.runInThisContext() and
      // read the resulting functions off the global object by design (see
      // test/helpers/loadClassicScript.js) -- there is no module to import
      // them from.
      "no-undef": "off",
    },
  },
]);
