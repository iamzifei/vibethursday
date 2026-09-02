/**
 * No route may build a link out of `request.url`.
 *
 * ⚠️ This exists because it shipped. `/api/deck` redirected to
 * `new URL(..., request.url)`, which is correct on a laptop and wrong in
 * production: the process sits behind a proxy, so `request.url` is the address
 * the container answers on. The first person to open a room was handed
 * `https://localhost:8080/present/1032?k=...` — a link nobody can open, from a
 * feature that had otherwise been tested end to end.
 *
 * It is invisible in development, invisible in the build, and invisible in
 * every test that runs against localhost, which is why the check is on the
 * source rather than on behaviour. `requestOrigin()` is the answer: it prefers
 * NEXT_PUBLIC_SITE_URL, then the forwarded host, and validates what it gets.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

test("★ no absolute URL is built from request.url", () => {
  const root = path.join(process.cwd(), "src");

  // `new URL(anything, request.url)` — the second argument is the base, and
  // that is the part that is wrong behind a proxy. Reading `request.url` to get
  // at a query string is fine and stays allowed.
  const asBase = /new URL\([^)]*,\s*(?:request|req)\.url\s*\)/;

  const offenders = sourceFiles(root).filter((file) =>
    asBase.test(readFileSync(file, "utf8")),
  );

  assert.deepEqual(
    offenders.map((file) => path.relative(process.cwd(), file)),
    [],
    "use requestOrigin() from @/lib/request-origin as the base instead",
  );
});

test("the origin helper reads the forwarded host before the raw one", () => {
  // Pinned as source rather than behaviour because the module imports
  // `next/headers`, which the test runner's type stripper cannot resolve.
  const source = readFileSync(
    path.join(process.cwd(), "src/lib/request-origin.ts"),
    "utf8",
  );

  assert.match(source, /x-forwarded-host/, "the proxy's host header is not consulted");
  assert.ok(
    source.indexOf('"x-forwarded-host"') < source.indexOf('"host"'),
    "x-forwarded-host must be preferred over host, not the other way round",
  );
  // The proto deliberately does NOT follow the same rule: the dev server sets
  // `x-forwarded-proto: http` on every request, so trusting it would emit
  // http:// links for a site that is https everywhere but loopback.
  //
  // Matched on the *call* rather than the name, because the comment in that
  // file explaining this decision mentions the header — which is exactly what
  // the first version of this assertion tripped over.
  assert.doesNotMatch(
    source,
    /get\(\s*"x-forwarded-proto"/,
    "x-forwarded-proto is set to http by the dev server; see the comment there",
  );
});
