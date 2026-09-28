import assert from "node:assert/strict";
import { test } from "node:test";
import { callerIp } from "../src/lib/rate-limit.ts";

/**
 * Whose address a request is (`callerIp` in `src/lib/rate-limit.ts`).
 *
 * Measured on production 2026-09-28 through /api/admin/ip-headers: the hosting
 * proxy APPENDS to X-Forwarded-For rather than replacing it, and passes any
 * other header the caller sets straight through. So the last entry is the one
 * the proxy wrote, and everything before it — and `cf-connecting-ip`, and
 * `x-real-ip` — is whatever the caller chose to send. Until this change every
 * rate limit on the site keyed on the first entry, so a script could pick a
 * fresh address per request and never be limited.
 */

const headers = (values: Record<string, string>) => (name: string) => values[name.toLowerCase()] ?? null;

test("a plain request: the one address the proxy wrote", () => {
  assert.equal(callerIp(headers({ "x-forwarded-for": "101.166.113.80" })), "101.166.113.80");
});

test("★ a caller-supplied X-Forwarded-For is ignored; the proxy's own entry is used", () => {
  // Exactly what production received when the request carried
  // "X-Forwarded-For: 9.9.9.9".
  assert.equal(callerIp(headers({ "x-forwarded-for": "9.9.9.9, 101.166.113.80" })), "101.166.113.80");
  assert.equal(callerIp(headers({ "x-forwarded-for": "1.1.1.1,2.2.2.2 ,  101.166.113.80 " })), "101.166.113.80");
});

test("★ headers the caller can set on their own are never trusted", () => {
  // No CDN sits in front of this site, so cf-connecting-ip is caller-written.
  assert.equal(
    callerIp(headers({ "cf-connecting-ip": "9.9.9.9", "x-real-ip": "8.8.8.8", "x-forwarded-for": "101.166.113.80" })),
    "101.166.113.80",
  );
});

test("no forwarding header at all is 'unknown', not a crash", () => {
  assert.equal(callerIp(headers({})), "unknown");
  assert.equal(callerIp(headers({ "x-forwarded-for": "  " })), "unknown");
  assert.equal(callerIp(headers({ "x-forwarded-for": "1.1.1.1, " })), "1.1.1.1");
});
