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
