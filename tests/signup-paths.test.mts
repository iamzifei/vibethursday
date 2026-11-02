/**
 * Four fixes from walking the site as a newcomer (2026-11-02):
 *
 * 1. Tuesday was several taps away: the bar only ever offered Thursday, and a
 *    check-in code opened on the wrong day was a dead end with "this week".
 * 2. A fee marked paid by hand looked exactly like a card payment, so the
 *    books could not tell the two apart.
 * 3. "What did I sign up for", "my card" and "am I a member" lived on three
 *    pages. /my now answers all three.
 * 4. Public pages show the price before GST; GST is added where you pay.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";
import { navCtaFor, NAV_LINKS } from "../src/lib/nav.ts";
import { buildDesk, deskExportRow, type DeskRow } from "../src/lib/desk.ts";
import { feeLabel, payLabel } from "../src/lib/tuesday-fee.ts";
import { IP_COURSE, MEMBERSHIP } from "../src/lib/course.ts";
import { SCREEN_TUESDAY } from "../src/lib/screen.ts";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

// ── 1. Tuesday and Thursday both one tap away ───────────────────────────────

test("the bar's sign-up button follows the page: Tuesday on /tuesday, Thursday elsewhere", () => {
  assert.deepEqual(navCtaFor("/tuesday"), { href: "/tuesday#signup", label: "ctaTuesday" });
  assert.deepEqual(navCtaFor("/tuesday/pay"), { href: "/tuesday#signup", label: "ctaTuesday" });
  assert.deepEqual(navCtaFor("/"), { href: "/#signup", label: "cta" });
  assert.deepEqual(navCtaFor("/members"), { href: "/#signup", label: "cta" });
  assert.equal(copy.zh.nav.ctaTuesday, "报名周二");
  assert.ok(copy.en.nav.ctaTuesday.length > 0);
});

test("both sign-up forms open with a Thursday / Tuesday switch", () => {
  for (const file of ["src/app/page.tsx", "src/app/tuesday/page.tsx"]) {
    assert.match(read(file), /<DaySwitch\b/, `${file} has no day switch above its form`);
  }
  const zh = copy.zh.daySwitch;
  assert.ok(zh.thursday && zh.tuesday && zh.label, "the switch needs both day labels and an aria label");
});

test("a check-in code on the wrong day offers both sign-ups and /my, not just 'this week'", () => {
  const page = read("src/app/checkin/page.tsx");
  // The invalid branch is the one under `if (!valid)`.
  const invalid = page.slice(page.indexOf("if (!valid)"), page.indexOf("if (!valid)") + 1500);
  assert.match(invalid, /\/tuesday#signup/);
  assert.match(invalid, /\/#signup/);
  assert.match(invalid, /\/my/);
});

test("/my is in the bar", () => {
  assert.ok(NAV_LINKS.some((link) => link.href === "/my"), "no /my in NAV_LINKS");
  assert.ok(copy.zh.nav.my && copy.en.nav.my);
});

// ── 2. Paid by card vs marked by hand ───────────────────────────────────────

const row = (over: Partial<DeskRow>): DeskRow => ({
  id: "1", name: "A", wechat: null, booked: true, waitlisted: false, checked_in_at: null, source: null,
  member: false, mentor: false, builder: false, fee_status: null, paid_via: null, claimed_at: null,
  bring: null, topic: null, building: null, sessions: [], ...over,
});

test("a fee marked paid by hand is its own state on the desk and in the export", () => {
  const [card] = buildDesk([row({ fee_status: "paid", paid_via: "card" })], true);
  const [admin] = buildDesk([row({ fee_status: "paid", paid_via: "admin" })], true);
  const [helper] = buildDesk([row({ fee_status: "paid", paid_via: "helper" })], true);
  assert.equal(card.pay, "paid");
  assert.equal(admin.pay, "marked");
  assert.equal(helper.pay, "marked");
  assert.match(deskExportRow(helper)[4], /手动/);
  assert.doesNotMatch(deskExportRow(card)[4], /手动/);
});

test("card payments and hand marks write who settled the fee", () => {
  const db = read("src/lib/db.ts");
  assert.match(db, /ADD COLUMN IF NOT EXISTS paid_via text/);
  assert.match(db, /status = 'paid', paid_at = now\(\), paid_via = 'card'/);
  const route = read("src/app/api/admin/tuesday-fee/route.ts");
  assert.match(route, /setSessionFeeStatus\(fee\.id, status, admin \? "admin" : "helper"\)/);
});

// ── 3. One "mine" page ──────────────────────────────────────────────────────

test("/my shows the card and the roles, not only the sessions", () => {
  const page = read("src/app/my/page.tsx");
  assert.match(page, /getMyExtras\(/);
  for (const key of ["cardTitle", "cardPublished", "cardDraft", "cardNone", "rolesTitle"] as const) {
    assert.ok(copy.zh.my[key], `copy.zh.my.${key} missing`);
    assert.ok(copy.en.my[key], `copy.en.my.${key} missing`);
  }
});

// ── 4. No "+ GST" on public pages ───────────────────────────────────────────

test("public prices are shown before GST, with no '+ GST'", () => {
  assert.equal(feeLabel(30), "30 澳元");
  assert.equal(feeLabel(30, "en"), "A$30");
  assert.equal(MEMBERSHIP.priceLabel, "599 澳元");
  assert.equal(IP_COURSE.priceLabel, "365 澳元");
  assert.doesNotMatch(SCREEN_TUESDAY.price, /GST/);
  const publicSources = [
    JSON.stringify(copy.zh),
    JSON.stringify(copy.en),
    read("src/app/join/page.tsx"),
    read("src/app/class/page.tsx"),
    read("src/app/tuesday/page.tsx"),
    read("src/lib/screen.ts"),
  ];
  for (const source of publicSources) assert.doesNotMatch(source, /\+\s*GST/);
});

test("where you pay, GST is added and shown", () => {
  assert.equal(payLabel(30), "33 澳元（30 + GST 3）");
  assert.match(MEMBERSHIP.payLabel, /658\.90/);
  assert.match(IP_COURSE.payLabel, /401\.50/);
});

// ── 5. The human check reads as a check, not as "signed up" ────────────────

test("Turnstile shows only when a click is needed, so its green tick is not read as 'done'", () => {
  assert.match(read("src/components/Turnstile.tsx"), /appearance: "interaction-only"/);
});

// ── 6. Direct payment links for people the organiser signs up himself ──────

test("the admin has a page with both direct payment links and their QR codes, organiser only", async () => {
  const page = read("src/app/admin/paylinks/page.tsx");
  assert.match(page, /isAdminSession/);
  assert.match(page, /PAYLINK_TUESDAY/);
  assert.match(page, /PAYLINK_MEMBER/);
  assert.match(page, /QRCode\.toDataURL/);
  // The links are configuration, not code: nothing from Stripe is written into this public repo.
  assert.doesNotMatch(page, /buy\.stripe\.com/);
  const { ADMIN_NAV } = await import("../src/lib/admin-nav.ts");
  assert.ok(ADMIN_NAV.flatMap((group) => group.links).some((link) => link.href === "/admin/paylinks"));
});
