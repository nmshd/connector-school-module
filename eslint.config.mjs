// @ts-check

import eslint from "@eslint/js";
import { configs } from "@js-soft/eslint-config-ts";
import { globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default tseslint.config(
    globalIgnores(["**/dist", "**/node_modules"]),
    {
        extends: [configs.base],
        languageOptions: {
            parserOptions: {
                project: ["./tsconfig.eslint.json", "./tsconfig.json", "./test/tsconfig.json"]
            }
        },
        files: ["src/**/*.ts"],
        rules: {}
    },
    {
        extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            parserOptions: {
                project: ["./ui/tsconfig.json"],
                sourceType: "module"
            }
        },
        files: ["ui/**/*.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-base-to-string": "off",
            "@typescript-eslint/prefer-promise-reject-errors": "off",
            "@typescript-eslint/restrict-plus-operands": "off",
            "@typescript-eslint/no-unsafe-call": "off"
        }
    }
);
