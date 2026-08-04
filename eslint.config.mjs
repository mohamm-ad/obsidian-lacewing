import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig(
	globalIgnores([
		"main.js",
		"node_modules/",
		"coverage/",
		"release/",
		"scripts/",
		"esbuild.config.mjs",
		"eslint.config.mjs",
		"vitest.config.ts",
	]),
	{
		languageOptions: {
			globals: globals.browser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts", "tests/**/*.ts"],
		rules: {
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": "error",
		},
	},
	{
		files: ["tests/**/*.ts"],
		rules: {
			"obsidianmd/no-global-this": "off",
		},
	},
);
