/**
 * /my — looking up, moving and cancelling your own signup.
 *
 * Added 2026-09-28 after a morning of people asking in the group "how do I
 * know I'm signed up?" and "I signed up for the wrong Thursday, how do I
 * change it?". The site could do neither: sessions were only ever added.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { canChangeSession, MY_TOKEN_TTL_MS, myToken, verifyMyToken } from "../src/lib/my-signup.ts";
import { badgeShowsCode } from "../src/lib/members.ts";
import { copy } from "../src/lib/content.ts";

const KEY = "test-secret-for-my-signup";
const NOW = Date.parse("2026-09-28T08:00:00Z");

test("a token names the signup it was issued for, until it expires", () => {
  const token = myToken("42", NOW, KEY);
  assert.equal(verifyMyToken(token, NOW, KEY), "42");
  assert.equal(verifyMyToken(token, NOW + MY_TOKEN_TTL_MS - 1000, KEY), "42");
  assert.equal(verifyMyToken(token, NOW + MY_TOKEN_TTL_MS + 1000, KEY), null);
});

test("a token cannot be edited into someone else's signup", () => {
  const token = myToken("42", NOW, KEY);
  assert.equal(verifyMyToken(token.replace(":42.", ":41."), NOW, KEY), null);
  // Stretching the expiry breaks the signature too.
  const [head, sig] = token.split("~");
  const stretched = head.replace(/\.(\d+)$/, (_, exp) => `.${Number(exp) + 86_400_000}`);
  assert.equal(verifyMyToken(`${stretched}~${sig}`, NOW, KEY), null);
  assert.equal(verifyMyToken(token, NOW, "another-key"), null);
});

test("garbage is not a token", () => {
  for (const value of [undefined, null, "", "vt.my.v1:", "vt.order.v1:2026-10-01", "x".repeat(500)]) {
    assert.equal(verifyMyToken(value, NOW, KEY), null);
  }
});

test("only today's and later sessions can be cancelled or moved", () => {
  // Past sessions are the attendance record: the wall and the check-ins hang
  // off them, and nobody needs to un-sign-up from last week.
  assert.equal(canChangeSession("2026-10-01", "2026-09-28"), true);
  assert.equal(canChangeSession("2026-09-28", "2026-09-28"), true);
  assert.equal(canChangeSession("2026-09-24", "2026-09-28"), false);
  assert.equal(canChangeSession("not-a-date", "2026-09-28"), false);
});

test("★ an unpublished card's badge offers no QR code and no shareable image", () => {
  // 2026-09-28: a draft card's exported image carried a QR code to a page that
  // only exists once the card is published. It was shared in the group and
  // scanned to a 404.
  assert.equal(badgeShowsCode({ published: false, hidden: false }), false);
  assert.equal(badgeShowsCode({ published: true, hidden: true }), false);
  assert.equal(badgeShowsCode({ published: true, hidden: false }), true);
});

test("/my copy exists in both languages with the same keys", () => {
  const zh = copy.zh.my as Record<string, unknown>;
  const en = copy.en.my as Record<string, unknown>;
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
});

test("a name hint shows only the first and last character", async () => {
  const { nameHint } = await import("../src/lib/my-signup.ts");
  assert.equal(nameHint("Dennis Lee"), "D…e");
  assert.equal(nameHint("王小明"), "王…明");
  assert.equal(nameHint("王明"), "王…");
  assert.equal(nameHint(""), "…");
});
