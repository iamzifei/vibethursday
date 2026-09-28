/**
 * /play's weekly board, the coffee-bean rush and server-side high-fives.
 *
 * Every point on the board has to come from something the server saw itself —
 * the progress already in the game lives in each browser's localStorage, and a
 * board built on that is a board a script tops in a second (2026-09-28).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  DAILY_TASK_MAX,
  HIGH_FIVE_PAIRS_PER_DAY,
  isDoubleTime,
  loginAwards,
  pairKey,
  POINTS,
  streakFromDays,
  weekStart,
} from "../src/lib/game/points.ts";
import { canClaim, isJump, nextRushDelay, pickRushSpot, RUSH_LIFETIME_MS } from "../src/lib/game/rush.ts";
import { guestIdentity, guestToken, readGuestToken } from "../src/lib/game/player-id.ts";
import { isWalkable, reachable, place, SPAWN, type GameMap } from "../src/lib/game/world.ts";
import { GUEST_ANIMALS } from "../src/lib/game/protocol.ts";

const harbour = JSON.parse(readFileSync(path.join(process.cwd(), "src/lib/game/maps/harbour.json"), "utf8")) as GameMap;

// ── The week ─────────────────────────────────────────────────────────

test("a week starts on the Monday, Sydney date", () => {
  assert.equal(weekStart("2026-09-28"), "2026-09-28"); // a Monday
  assert.equal(weekStart("2026-10-01"), "2026-09-28"); // Thursday
  assert.equal(weekStart("2026-10-04"), "2026-09-28"); // Sunday
  assert.equal(weekStart("2026-10-05"), "2026-10-05"); // next Monday
});

test("double points only on a Sydney Thursday, 10:00 to 13:00", () => {
  // 2026-10-01 is a Thursday; Sydney is UTC+10 then.
  assert.equal(isDoubleTime(new Date("2026-10-01T00:30:00Z")), true); // 10:30
  assert.equal(isDoubleTime(new Date("2026-10-01T02:59:00Z")), true); // 12:59
  assert.equal(isDoubleTime(new Date("2026-10-01T03:00:00Z")), false); // 13:00
  assert.equal(isDoubleTime(new Date("2026-09-30T23:59:00Z")), false); // 09:59
  assert.equal(isDoubleTime(new Date("2026-10-02T00:30:00Z")), false); // Friday
});

// ── Logging in ───────────────────────────────────────────────────────

test("the streak is consecutive Sydney days ending today", () => {
  assert.equal(streakFromDays(["2026-09-26", "2026-09-27", "2026-09-28"], "2026-09-28"), 3);
  assert.equal(streakFromDays(["2026-09-25", "2026-09-27", "2026-09-28"], "2026-09-28"), 2);
  assert.equal(streakFromDays(["2026-09-27"], "2026-09-28"), 0); // not today yet
  assert.equal(streakFromDays([], "2026-09-28"), 0);
});

test("logging in pays once a day, with milestone bonuses at 3 and every 7", () => {
  const sum = (streak: number) => loginAwards(streak, "2026-09-28").reduce((total, award) => total + award.points, 0);
  assert.equal(sum(1), POINTS.login);
  assert.equal(sum(3), POINTS.login + POINTS.streak3);
  assert.equal(sum(7), POINTS.login + POINTS.streak7);
  assert.equal(sum(14), POINTS.login + POINTS.streak7);
  assert.equal(sum(8), POINTS.login);
  // Every award carries the day as its ref, so a second join the same day is a no-op.
  for (const award of loginAwards(7, "2026-09-28")) assert.equal(award.ref, "2026-09-28");
});

test("caps are what the plan says", () => {
  assert.equal(DAILY_TASK_MAX, 3);
  assert.equal(HIGH_FIVE_PAIRS_PER_DAY, 10);
  assert.equal(pairKey("b", "a"), pairKey("a", "b"));
});

// ── The rush ─────────────────────────────────────────────────────────

test("a bean lands on walkable ground reachable from the spawn", () => {
  const spawn = place(harbour, SPAWN.harbour.lat, SPAWN.harbour.lon);
  const reach = reachable(harbour, spawn);
  for (let seed = 0; seed < 50; seed += 1) {
    let n = seed;
    const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const spot = pickRushSpot(harbour, "harbour", reach, rand);
    assert.ok(spot, "found a spot");
    assert.ok(isWalkable(harbour, spot.x, spot.y));
    assert.equal(reach[spot.y * harbour.width + spot.x], 1);
  }
});

test("rush timing: 90–180s normally, 45s in double time", () => {
  assert.equal(nextRushDelay(() => 0, false), 90_000);
  assert.equal(nextRushDelay(() => 0.999999, false) <= 180_000, true);
  assert.equal(nextRushDelay(() => 0.5, true), 45_000);
  assert.equal(RUSH_LIFETIME_MS, 60_000);
});

test("claiming needs the server's own position next to the bean, and no recent jump", () => {
  const now = 1_000_000;
  const rush = { id: "r1", map: "harbour", x: 50, y: 60, until: now + 30_000 };
  const near = { map: "harbour", x: 50.8, y: 60.5, jumpedAt: 0 };
  assert.equal(canClaim(rush, near, now), true);
  assert.equal(canClaim(rush, { ...near, x: 53 }, now), false); // too far
  assert.equal(canClaim(rush, { ...near, map: "chatswood" }, now), false);
  assert.equal(canClaim(rush, { ...near, jumpedAt: now - 2_000 }, now), false); // just teleported
  assert.equal(canClaim(rush, { ...near, jumpedAt: now - 6_000 }, now), true);
  assert.equal(canClaim({ ...rush, until: now - 1 }, near, now), false); // expired
  assert.equal(canClaim(null, near, now), false);
});

test("a jump is faster than anyone walks; a step is not", () => {
  // 5.5 tiles/s walking, plus slack.
  assert.equal(isJump({ map: "harbour", x: 10, y: 10 }, { map: "harbour", x: 11, y: 10 }, 200), false);
  assert.equal(isJump({ map: "harbour", x: 10, y: 10 }, { map: "harbour", x: 40, y: 10 }, 200), true);
  assert.equal(isJump({ map: "harbour", x: 10, y: 10 }, { map: "chatswood", x: 10, y: 10 }, 200), true);
  assert.equal(isJump({ map: "none", x: 0, y: 0 }, { map: "harbour", x: 40, y: 10 }, 200), true);
});

// ── Guests ───────────────────────────────────────────────────────────

test("a guest token is signed and gives the same animal every time", () => {
  const key = "test-key";
  const token = guestToken(key);
  const id = readGuestToken(token, key);
  assert.ok(id);
  assert.equal(readGuestToken(token, "other-key"), null);
  assert.equal(readGuestToken(token.replace(/~.*/, "~" + "A".repeat(22)), key), null);
  assert.equal(readGuestToken("vt.my.v1:1.2~x", key), null);
  const [animal, number] = guestIdentity(id!);
  assert.deepEqual(guestIdentity(id!), [animal, number]);
  assert.ok(animal >= 0 && animal < GUEST_ANIMALS);
  assert.ok(number >= 10 && number < 100);
});

// ── The room: server-side high-fives and the rush ────────────────────

import { claimRush, drainAwards, join, move, resetRoom, setRush, snapshot } from "../src/lib/game/room.ts";
import { DEFAULT_LOOK } from "../src/lib/game/protocol.ts";

const at = (seat: { id: string; key: string }, x: number, y: number, emote: string | null = null) =>
  move({ id: seat.id, key: seat.key, map: "harbour", x, y, dir: 0, look: DEFAULT_LOOK, emote: emote as never });

test("two people waving next to each other is a high-five the server pays, once a day", async () => {
  resetRoom();
  const a = join({ memberId: "1", name: "Ann", slug: "ann" })!;
  const b = join({ memberId: null, name: null, slug: null, guestId: "0123456789abcdef" })!;
  at(a, 10, 10);
  at(b, 11, 10);
  await new Promise((r) => setTimeout(r, 120));
  at(a, 10, 10, "wave");
  at(b, 11, 10, "wave");
  const awards = drainAwards();
  assert.equal(awards.filter((award) => award.reason === "highfive").length, 2, "both get paid");
  assert.deepEqual(new Set(awards.map((award) => award.player)), new Set(["m:1", "g:0123456789abcdef"]));

  await new Promise((r) => setTimeout(r, 120));
  at(a, 10, 10, "wave");
  at(b, 11, 10, "wave");
  assert.equal(drainAwards().length, 0, "same pair, same day: nothing more");
  resetRoom();
});

test("waving at someone across the map is not a high-five", async () => {
  resetRoom();
  const a = join({ memberId: "1", name: "Ann", slug: "ann" })!;
  const b = join({ memberId: "2", name: "Bo", slug: "bo" })!;
  at(a, 10, 10);
  at(b, 30, 10);
  await new Promise((r) => setTimeout(r, 120));
  at(a, 10, 10, "wave");
  at(b, 30, 10, "wave");
  assert.equal(drainAwards().length, 0);
  resetRoom();
});

test("a bean goes to the first player the server sees next to it, and only once", async () => {
  resetRoom();
  const a = join({ memberId: "1", name: "Ann", slug: "ann" })!;
  const b = join({ memberId: "2", name: "Bo", slug: "bo" })!;
  at(a, 50, 60);
  at(b, 50, 61);
  // Appearing on the map counts as a jump (JUMP_GRACE_MS), so a script cannot
  // join standing on a bean and take it: wait out the grace first.
  await new Promise((r) => setTimeout(r, 5_100));
  setRush({ id: "bean1", map: "harbour", x: 50, y: 60, until: Date.now() + 30_000 });
  assert.equal(claimRush(b.id, b.key, "bean1"), true);
  assert.equal(claimRush(a.id, a.key, "bean1"), false, "already taken");
  const awards = drainAwards();
  assert.equal(awards.length, 1);
  assert.equal(awards[0].player, "m:2");
  assert.equal(awards[0].reason, "rush");
  assert.equal(JSON.parse(snapshot()).rush, null);
  resetRoom();
});

test("a claim from a player the server has not seen there pays nothing", async () => {
  resetRoom();
  const a = join({ memberId: "1", name: "Ann", slug: "ann" })!;
  at(a, 10, 10);
  setRush({ id: "bean2", map: "harbour", x: 50, y: 60, until: Date.now() + 30_000 });
  assert.equal(claimRush(a.id, a.key, "bean2"), false);
  assert.equal(claimRush(a.id, "wrong-key-wrong-key", "bean2"), false);
  assert.equal(drainAwards().length, 0);
  resetRoom();
});

test("the snapshot still carries no keys, member ids or player keys", () => {
  resetRoom();
  const a = join({ memberId: "42", name: "Ann", slug: "ann" })!;
  at(a, 10, 10);
  const text = snapshot();
  assert.ok(!text.includes(a.key));
  assert.ok(!text.includes("m:42"));
  assert.ok(!text.includes('"memberId"'));
  resetRoom();
});

test("one player wins at most RUSH_WINS_PER_DAY beans a day", async () => {
  const { RUSH_WINS_PER_DAY } = await import("../src/lib/game/room.ts");
  resetRoom();
  const a = join({ memberId: "1", name: "Ann", slug: "ann" })!;
  at(a, 50, 60);
  await new Promise((r) => setTimeout(r, 5_100));
  let won = 0;
  for (let i = 0; i < RUSH_WINS_PER_DAY + 2; i += 1) {
    setRush({ id: `cap${i}`, map: "harbour", x: 50, y: 60, until: Date.now() + 30_000 });
    if (claimRush(a.id, a.key, `cap${i}`)) won += 1;
  }
  assert.equal(won, RUSH_WINS_PER_DAY);
  drainAwards();
  resetRoom();
});
