/**
 * The back office caught up with the public site (2026-11-18).
 *
 * Build Tuesday has been online since 2026-11-10 (changelog 5.11): no door,
 * no fee, members and the 导师团 only. The desk, Today, the door code, the
 * waitlist and the follow-up list still treated it as a room. And people who
 * sign up through the WeChat group bot often have no WeChat ID, only a group
 * nickname, which the desk showed as "没填微信号".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { buildDesk, DESK_EXPORT_COLUMNS, deskExportRow, deskModeFor, deskStats, wechatOrNickname, type DeskRow } from "../src/lib/desk.ts";
import { followUps } from "../src/lib/followup.ts";
import { ADMIN_NAV } from "../src/lib/admin-nav.ts";

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
  mentor: false,
  volunteer: false,
  builder: false,
  fee_status: null,
  paid_via: null,
  claimed_at: null,
  bring: null,
  topic: null,
  building: null,
  sessions: [],
  ...over,
});

test("★ each date gets the desk it needs: Thursday free, old Tuesday paid, online Tuesday by access", () => {
  assert.equal(deskModeFor("2026-11-19"), "free");
  assert.equal(deskModeFor("2026-11-03"), "paid");
  assert.equal(deskModeFor("2026-11-10"), "trial", "the open trial let anyone in");
  assert.equal(deskModeFor("2026-12-01"), "online");
});

test("★ on an online Tuesday the desk says who may be added to the group, never what is owed", () => {
  const desk = buildDesk(
    [
      row({ id: "1", member: true }),
      row({ id: "2", mentor: true }),
      // Volunteers were free in the room; online is members and mentors only.
      row({ id: "3", volunteer: true }),
      row({ id: "4" }),
      // A fee row left over from before must not turn into "owing".
      row({ id: "5", fee_status: "pending" }),
    ],
    "online",
  );
  const pay = Object.fromEntries(desk.map((entry) => [entry.id, entry.pay]));
  assert.deepEqual(pay, { "1": "member", "2": "mentor", "3": "noAccess", "4": "noAccess", "5": "noAccess" });
  const stats = deskStats(desk);
  assert.equal(stats.noAccess, 3);
  assert.equal(stats.canJoin, 2);
  assert.equal(stats.owing, 0);
});

test("a waitlisted-only row counts as neither 可以进群 nor 不是会员 (review 2026-11-18)", () => {
  const stats = deskStats(buildDesk([row({ id: "1", member: true }), row({ id: "2", member: true }), row({ id: "3", member: true }), row({ id: "4", booked: false, waitlisted: true })], "online"));
  assert.equal(stats.booked, 3);
  assert.equal(stats.canJoin, 3);
  assert.equal(stats.noAccess, 0);
});

test("on the open-trial Tuesday everyone who booked is in", () => {
  const desk = buildDesk([row({ id: "1" }), row({ id: "2", member: true })], "trial");
  assert.deepEqual(desk.map((entry) => entry.pay).sort(), ["member", "trial"]);
  assert.equal(deskStats(desk).noAccess, 0);
});

test("the older true/false form still means paid / free", () => {
  assert.equal(buildDesk([row({})], true)[0].pay, "owing");
  assert.equal(buildDesk([row({})], false)[0].pay, "free");
});

test("★ a bot signup is shown by its group nickname, not as 没填微信号", () => {
  assert.equal(wechatOrNickname({ wechat: "ann_01", wechat_name: null }, true), "ann_01");
  assert.equal(wechatOrNickname({ wechat: "ann_01", wechat_name: null }, false), "ann***");
  assert.equal(wechatOrNickname({ wechat: null, wechat_name: "Kevin - AI短视频" }, true), "群里报名 · 群昵称 Kevin - AI短视频");
  assert.equal(wechatOrNickname({ wechat: null, wechat_name: null }, true), "没填微信号");
  // And the after-event sheet carries the nickname, in its last column.
  assert.equal(DESK_EXPORT_COLUMNS.at(-1), "群昵称");
  const [entry] = buildDesk([row({ wechat: null, wechat_name: "Kevin" })], false);
  assert.equal(deskExportRow(entry).at(-1), "Kevin");
  // The desk query reads the nickname.
  assert.match(read("src/lib/db.ts"), /g\.wechat, nullif\(g\.wechat_name, ''\) AS wechat_name/);
});

test("★ an online Tuesday's follow-up list is who booked, since nobody checks in", () => {
  const desk = buildDesk(
    [
      row({ id: "1", member: true, bring: "need", sessions: ["2026-12-01"] }),
      row({ id: "2", member: true, booked: false, waitlisted: true, bring: "need" }),
      // Booked but not let in: was never in the group, so nothing to follow up.
      row({ id: "3", bring: "need", sessions: ["2026-12-01"] }),
    ],
    "online",
  );
  const items = followUps(desk, "2026-12-01");
  assert.deepEqual(items.map((item) => item.entry.id), ["1"]);
});

test("the menu no longer offers a Tuesday door, a Tuesday fee or dinner", () => {
  const tue = ADMIN_NAV.find((group) => group.title.startsWith("周二"));
  assert.ok(tue);
  assert.ok(!tue.links.some((link) => link.href.startsWith("/admin/door")), "no door online");
  const all = ADMIN_NAV.flatMap((group) => group.links);
  assert.ok(!all.some((link) => link.href.includes("tuesday-fees")), "no fee section to land on");
  assert.ok(!all.some((link) => link.label.includes("聚餐")), "the dinner stopped on 2026-11-05");
  assert.ok(!all.some((link) => link.hint?.includes("30 和 599")), "those payment links were removed");
});

test("the door, Today and the waitlist know there is no door online", () => {
  const door = read("src/app/admin/door/page.tsx");
  assert.match(door, /if \(isOnlineSession\(session\)\)/);
  // The print example is a Thursday, not an online Tuesday.
  assert.doesNotMatch(door, /\?s=2026-11-10/);
  assert.match(read("src/app/admin/today/page.tsx"), /show: can\(role, "desk"\) && !online/);
  // The waitlist is Thursday's; it no longer follows the desk onto a Tuesday.
  const waitlist = read("src/app/admin/waitlist/page.tsx");
  assert.match(waitlist, /sessionForDay\("thu"\)/);
  assert.doesNotMatch(waitlist, /deskFocus\(\)/);
});

test("the members page talks about access to the online Tuesdays, not a waived fee", () => {
  const page = read("src/app/admin/members/page.tsx");
  assert.doesNotMatch(page, /自动免收/);
  assert.doesNotMatch(page, /付过 599/);
  assert.match(page, /MEMBERSHIP\.priceLabel/);
});

test("this public repo does not name the organiser's private folders", () => {
  assert.doesNotMatch(read("src/app/admin/page.tsx"), /sydney-meetup/);
});
