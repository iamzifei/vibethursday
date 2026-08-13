/**
 * Teaches plain Node the `@/` path alias from tsconfig.
 *
 * Only used by the scripts in this directory: Next resolves the alias itself,
 * so nothing shipped needs this.
 */
import { register } from "node:module";
register("./resolve-alias.mjs", import.meta.url);
