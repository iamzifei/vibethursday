import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { sameSignupName } from "../src/lib/capacity.ts";
import { bodyTooLarge } from "../src/lib/rate-limit.ts";

/**
 * Batch A of the 2026-09-28 site review: the findings that let one visitor
 * change another's data, or knock the server over.
 */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

test("★ a signup only rewrites someone's profile when the name matches too", () => {
  // Knowing a WeChat ID alone must not let anyone rename a person, rewrite
  // what they are working on, or put words on the Wharf under their name.
  assert.equal(sameSignupName("Kevin Wang", "kevin wang"), true);
  assert.equal(sameSignupName("Kevin Wang", "  Kevin  Wang "), true);
  assert.equal(sameSignupName("ＫＥＶＩＮ", "kevin"), true);
  // A regular who adds a surname, or drops it, is still the same person.
  assert.equal(sameSignupName("Kevin", "Kevin Wang"), true);
  assert.equal(sameSignupName("Kevin Wang", "Kevin"), true);
  // Somebody else typing a victim's WeChat ID under their own name is not.
  assert.equal(sameSignupName("Mallory", "Kevin Wang"), false);
  assert.equal(sameSignupName("", "Kevin"), false);
  assert.equal(sameSignupName("K", "Kevin"), false, "one letter is not a name match");
});

test("★ a request body over the limit is refused before anything reads it", () => {
  const req = (length: string | null) =>
    new Request("http://x/api/feedback", { method: "POST", headers: length ? { "content-length": length } : {} });

  assert.equal(bodyTooLarge(req("100"), 64 * 1024), false);
  assert.equal(bodyTooLarge(req(String(150 * 1024 * 1024)), 64 * 1024), true);
  assert.equal(bodyTooLarge(req("not-a-number"), 64 * 1024), true, "an unreadable length is refused");
  // No declared length (chunked): not refused here; the platform caps it.
  assert.equal(bodyTooLarge(req(null), 64 * 1024), false);
});

test("★ an organiser's hide cannot be undone by the member saving their card", () => {
  const db = read("src/lib/db.ts");
  assert.match(db, /hidden_by_admin/, "admin hides are recorded separately");
  assert.match(db, /hidden\s*=\s*\(\$10(::boolean)? OR hidden_by_admin\)/, "a member save keeps an admin hide");
});

test("★ the signup route only takes JSON, so another site cannot post a form into it", () => {
  const route = read("src/app/api/signup/route.ts");
  assert.match(route, /application\/json/);
  assert.ok(route.indexOf("application/json") < route.indexOf("request.json()"), "checked before parsing");
});

test("★ the signup and claim forms post, so nothing typed ends up in a URL", () => {
  assert.match(read("src/components/SignupForm.tsx"), /<form[\s\S]{0,600}method="post"/);
  assert.match(read("src/components/ClaimForm.tsx"), /<form[\s\S]{0,600}method="post"/);
});
