import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url).href;

export function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  let url = SRC + specifier.slice(2);

  // tsconfig lets these omit the extension; Node does not.
  if (!existsSync(fileURLToPath(url))) {
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(fileURLToPath(url + ext))) { url += ext; break; }
    }
  }

  return next(url, context);
}
