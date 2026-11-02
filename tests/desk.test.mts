/**
 * The check-in desk (2026-11-02): one page an assistant at the door uses to
 * see who signed up, who has arrived, and — on a paid Tuesday — who still owes
 * the fee, and to tick each of those off.
 *
 * Pure: no database. The page and the two routes it posts to are checked by
 * reading their source.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { buildDesk, deskReturnPath, deskStats, filterDesk, type DeskRow } from "../src/lib/desk.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const row = (over: Partial<DeskRow>): DeskRow => ({
  id: "1",
  name: "Ann",
  wechat: "ann_01",
  booked: true,
  waitlisted: false,
  checked_in_at: null,
  source: null,
  member: false,
  fee_status: null,
  claimed_at: null,
  bring: null,
  topic: null,
  ...over,
});

test("★ on a paid Tuesday each person is member / paid / waived / says-paid / owing", () => {
  const desk = buildDesk(
    [
      row({ id: "1", member: true }),
      row({ id: "2", fee_status: "paid" }),
      row({ id: "3", fee_status: "waived" }),
      row({ id: "4", claimed_at: "11-03 09:10" }),
      row({ id: "5" }),
      // A member whose fee row says pending is still a member: they never owe.
      row({ id: "6", member: true, fee_status: "pending" }),
    ],
    true,
  );
  const pay = Object.fromEntries(desk.map((entry) => [entry.id, entry.pay]));
  assert.deepEqual(pay, { "1": "member", "2": "paid", "3": "waived", "4": "claimed", "5": "owing", "6": "member" });
});

test("on a free Thursday nobody owes anything", () => {
  const desk = buildDesk([row({ id: "1" }), row({ id: "2", fee_status: "pending" })], false);
  assert.deepEqual(desk.map((entry) => entry.pay), ["free", "free"]);
});

test("★ who has not arrived comes first; a walk-in is someone who checked in without booking", () => {
  const desk = buildDesk(
    [
      row({ id: "1", name: "Zed", checked_in_at: "10:31", source: "qr" }),
      row({ id: "2", name: "Bea" }),
      row({ id: "3", name: "Cal", booked: false, checked_in_at: "10:40", source: "walk-in" }),
      row({ id: "4", name: "Ada", booked: false, waitlisted: true }),
    ],
    true,
  );
  assert.deepEqual(desk.map((entry) => entry.id), ["4", "2", "3", "1"], "not arrived (by name), then arrived (latest first)");
  assert.equal(desk.find((entry) => entry.id === "3")?.walkIn, true);
  assert.equal(desk.find((entry) => entry.id === "4")?.walkIn, false);

  const stats = deskStats(desk);
  assert.equal(stats.booked, 2, "booked excludes walk-ins and the waitlist");
  assert.equal(stats.waitlisted, 1);
  assert.equal(stats.walkIns, 1);
  assert.equal(stats.arrived, 2);
  assert.equal(stats.notYet, 2);
  assert.equal(stats.owing, 2, "the two booked people; the walk-in and the waitlist are 'ask'");
});

test("the search matches name or WeChat ID, blind to case and spaces", () => {
  const desk = buildDesk([row({ id: "1", name: "Ann Lee", wechat: "AnnL_88" }), row({ id: "2", name: "Bob", wechat: null })], false);
  assert.deepEqual(filterDesk(desk, "annlee").map((entry) => entry.id), ["1"]);
  assert.deepEqual(filterDesk(desk, "annl_8").map((entry) => entry.id), ["1"]);
  assert.deepEqual(filterDesk(desk, " BOB ").map((entry) => entry.id), ["2"]);
  assert.equal(filterDesk(desk, "").length, 2);
});

test("★ the desk is organiser-only, and its buttons come back to it", () => {
  const page = read("src/app/admin/desk/page.tsx");
  assert.match(page, /isAdminSession/);
  assert.match(page, /name="back" value="desk"/);
  for (const route of ["src/app/api/admin/checkin/route.ts", "src/app/api/admin/tuesday-fee/route.ts"]) {
    // Only the one fixed path, never an address taken from the form.
    assert.match(read(route), /back === "desk"/, route);
    assert.match(read(route), /deskReturnPath/, route);
  }
});

// Spec change 2026-11-02 (admin frame): the jump bar became the sidebar.
test("the admin navigation leads with the desk", async () => {
  const { ADMIN_NAV } = await import("../src/lib/admin-nav.ts");
  assert.deepEqual(ADMIN_NAV[0].links.slice(0, 2).map((link) => link.href), ["/admin", "/admin/desk"]);
});

test("the room's check-in page ends with the day's one rule, never someone's own payment status", () => {
  const page = read("src/app/checkin/page.tsx");
  assert.match(page, /t\.doneTuesday/);
  assert.match(page, /t\.doneThursday/);
  assert.doesNotMatch(page, /listDeskRows|listTuesdayFeeDesk/, "no per-person fee on a page anyone with the code can open");
});

// Review 2026-11-02: the card payment page only takes people booked on that
// Tuesday, and marking someone paid books them (past the cap). So the desk
// offers payment only to the booked; a walk-in or the waitlist goes to the
// organiser.
test("★ on a paid Tuesday, someone not booked (walk-in, waitlist) is 'ask the organiser', never 'owing'", () => {
  const desk = buildDesk(
    [
      row({ id: "1", booked: false, checked_in_at: "10:40", source: "walk-in" }),
      row({ id: "2", booked: false, waitlisted: true }),
      row({ id: "3", booked: false, waitlisted: true, member: true }),
    ],
    true,
  );
  const pay = Object.fromEntries(desk.map((entry) => [entry.id, entry.pay]));
  assert.deepEqual(pay, { "1": "ask", "2": "ask", "3": "member" });
  assert.equal(deskStats(desk).owing, 0);
});

test("a button on the desk comes back to the same search and filter", () => {
  assert.equal(deskReturnPath("2026-11-03", "9", "ann", "waiting"), "/admin/desk?s=2026-11-03&q=ann&show=waiting#r-9");
  assert.equal(deskReturnPath("2026-11-03", "9", null, "bogus"), "/admin/desk?s=2026-11-03#r-9", "an unknown filter is dropped");
  assert.equal(deskReturnPath("2026-11-03", "9", "x".repeat(80), null), `/admin/desk?s=2026-11-03&q=${"x".repeat(50)}#r-9`);
});
