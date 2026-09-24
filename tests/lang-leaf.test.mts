import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * ★ The Traditional Chinese dictionary must never reach the browser.
 *
 * 2026-09-24, measured on the live site: every page shipped 638KB of
 * JavaScript, and 452KB of it — 71% — was the dictionary the Traditional
 * converter uses. Every reader downloaded it, including the ones who only ever
 * read Simplified, even though the server had already rendered the Traditional
 * page and the browser had no use for it.
 *
 * The cause was one line: the language switch in the header is a client
 * component, and it imported three small constants from `content.ts`, which
 * imports the converter at module level. Nothing reported it. The build
 * succeeded, the page rendered, the switch worked; the only symptom was a
 * number nobody was looking at.
 *
 * So this walks the import graph from every client component and fails the
 * moment any path reaches the copy bundle or the converter — whichever file
 * the offending import happens to be added to next time.
 */

const root = process.cwd();
const src = path.join(root, "src");

/** Modules that must stay on the server. */
const SERVER_ONLY = ["src/lib/content.ts", "src/lib/traditional.ts"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** Resolves an import specifier to a file under src, or null for packages. */
function resolve(spec: string, from: string): string | null {
  let base: string;

  if (spec.startsWith("@/")) base = path.join(src, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
}

/**
 * The runtime imports of a file — `import type` is erased at build time and
 * cannot pull anything into a bundle, so it is skipped. So is an `import`
 * whose every binding is marked `type`.
 */
function runtimeImports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found: string[] = [];

  for (const match of text.matchAll(/^\s*(import|export)\s+([^;]*?)\s+from\s+["']([^"']+)["']/gm)) {
    const [, , clause, spec] = match;

    if (/^type\s/.test(clause)) continue;

    const braces = clause.match(/\{([^}]*)\}/)?.[1];
    const hasDefault = /^[A-Za-z_$*]/.test(clause.replace(/\{[^}]*\}/, "").trim());
    const valueBindings = braces?.split(",").map((b) => b.trim()).filter((b) => b && !b.startsWith("type ")) ?? [];

    if (!hasDefault && braces !== undefined && valueBindings.length === 0) continue;

    const target = resolve(spec, file);
    if (target) found.push(target);
  }

  return found;
}

test("lang.ts is a leaf — it imports nothing", () => {
  const text = readFileSync(path.join(src, "lib/lang.ts"), "utf8");
  assert.ok(!/^\s*import\s/m.test(text), "src/lib/lang.ts has grown an import — it has to stay a leaf");
});

test("★ no client component can reach the copy bundle or the Traditional converter", () => {
  const clients = walk(src).filter((file) => /^\s*["']use client["']/.test(readFileSync(file, "utf8")));
  assert.ok(clients.length > 0, "found no client components — the walker is broken");

  const forbidden = new Set(SERVER_ONLY.map((file) => path.join(root, file)));
  // Collected rather than asserted one at a time: the first run of this found
  // a second path nobody knew about, and stopping at the first would have
  // hidden it behind the one being fixed.
  const leaks: string[] = [];

  for (const client of clients) {
    const seen = new Set<string>();
    const stack: { file: string; via: string[] }[] = [{ file: client, via: [] }];

    while (stack.length > 0) {
      const { file, via } = stack.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);

      for (const next of runtimeImports(file)) {
        const chain = [...via, path.relative(root, file)];

        if (forbidden.has(next)) {
          leaks.push(`${path.relative(root, client)}: ${chain.join(" → ")} → ${path.relative(root, next)}`);
          continue;
        }

        stack.push({ file: next, via: chain });
      }
    }
  }

  assert.deepEqual(leaks, [], `client code reaches server-only modules:\n  ${leaks.join("\n  ")}`);
});
