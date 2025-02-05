import globals from "globals";
import pluginReact from "eslint-plugin-react";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react/prop-types": "off"
    }
  },
  {
    files: ["**/*.test.{js,jsx}", "**/__tests__/**"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.jest,
        jest: true,
        expect: true,
        test: true,
        describe: true,
        beforeEach: true,
        afterEach: true
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    ...pluginReact.configs.flat.recommended,
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react/prop-types": "off"
    }
  }
];