import { test } from "node:test";
import assert from "node:assert/strict";

test("venue screen: the morning runs in time order and every code goes somewhere on this site", async () => {
  const { SCREEN_SCHEDULE, SCREEN_LINKS } = await import("../src/lib/screen.ts");
  const times = SCREEN_SCHEDULE.map((slot) => slot.time);
  assert.deepEqual([...times].sort(), times);
  assert.equal(times[0], "10:30");
  for (const href of Object.values(SCREEN_LINKS)) assert.match(href, /^\//);
  assert.equal(SCREEN_LINKS.checkin, "/go");
});

test("★ Thursday's screen sells nothing: its second slide sends people to Tuesday (2026-11-02)", async () => {
  const screen = await import("../src/lib/screen.ts");
  assert.equal("SCREEN_CLASS" in screen, false, "the class slide is gone");
  assert.equal(screen.SCREEN_LINKS.tuesday, "/tuesday");
  assert.ok(!(Object.values(screen.SCREEN_LINKS) as string[]).includes("/vip"));
});

// 2026-11-02: the room's pages work on a Build Tuesday as well as a Thursday.
test("★ on a Tuesday the screen shows Tuesday's day and the membership, not Thursday's morning", async () => {
  const { screenFor, SCREEN_LINKS } = await import("../src/lib/screen.ts");
  const thursday = screenFor(false);
  const tuesday = screenFor(true);
  assert.match(thursday.title, /每周四/);
  assert.match(tuesday.title, /周二|Tuesday/);
  assert.deepEqual(tuesday.schedule.map((slot) => slot.time), ["10:30", "12:00", "13:30"]);
  assert.equal(tuesday.second.href, SCREEN_LINKS.join, "Tuesday's close is the 共创会员");
  assert.equal(thursday.second.href, SCREEN_LINKS.tuesday, "Thursday still only points on to Tuesday");
  assert.ok(!JSON.stringify(thursday.schedule).includes("点饮品"), "no ordering on the site any more");
});

test("the check-in link on /go stays open through Tuesday's afternoon", async () => {
  const { checkinLinkOpen } = await import("../src/lib/go.ts");
  assert.equal(checkinLinkOpen(true, 13), false, "a Thursday closes at 13:00");
  assert.equal(checkinLinkOpen(true, 15, true), true, "a Tuesday is still open at 15:00");
  assert.equal(checkinLinkOpen(true, 16, true), false);
});
