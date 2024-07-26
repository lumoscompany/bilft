// @ts-check

import eslint from "@eslint/js";
import solid from "eslint-plugin-solid";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  solid.configs["flat/typescript"],
);
