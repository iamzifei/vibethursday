/**
 * /play — the pixel Sydney.
 *
 * Three kinds of thing are pinned down here.
 *
 * The first is that the world is walkable. The streets are rasterised from
 * OpenStreetMap, and a rasteriser does not know that a story needs you to get
 * from Circular Quay across the bridge to Milsons Point: one stray building
 * footprint over a footpath and a chapter becomes impossible, silently, with
 * a perfectly good-looking map. Every place the game sends you is checked
 * here against the real maps, on foot.
 *
 * The second is the privacy boundary. The game shows members, their work and
 * their questions; it must show nothing the public pages do not, and a
 * multiplayer room must never hand anybody else's key or member id to the
 * browser.
 *
 * The third is that the save and the wire format survive garbage, because
 * both come from somewhere the player controls.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  FERRY_WHARVES,
  LANDMARKS,
  PHOTO_SPOTS,
  SHARDS,
  SPAWN,
  STATIONS,
  STORY_NPCS,
  T1_STOPS,
  findPath,
  isSydneyThursday,
  place,
  reachable,
  tileAt,
  type GameMap,
  type MapId,
} from "../src/lib/game/world.ts";
import { DEFAULT_LOOK, PHRASES, clampLook, parseMove } from "../src/lib/game/protocol.ts";
import {
  SIDE_QUESTS,
  TOTALS,
  bumpDaily,
  dailyProgress,
  dailyTasks,
  readyToFinish,
  sideProgress,
  newSave,
  parseSave,
  questProgress,
  touchStreak,
  unlockedHats,
  currentQuest,
} from "../src/lib/game/state.ts";
import { GAME_COPY, fill } from "../src/lib/game/copy.ts";
import { join, leave, move, resetRoom, snapshot, MAX_PLAYERS, MIN_MOVE_MS } from "../src/lib/game/room.ts";

const root = process.cwd();
const maps: Record<MapId, GameMap> = {
  harbour: JSON.parse(readFileSync(path.join(root, "src/lib/game/maps/harbour.json"), "utf8")),
  chatswood: JSON.parse(readFileSync(path.join(root, "src/lib/game/maps/chatswood.json"), "utf8")),
};

const spawn = (id: MapId) => place(maps[id], SPAWN[id].lat, SPAWN[id].lon);
const reach = { harbour: reachable(maps.harbour, spawn("harbour")), chatswood: reachable(maps.chatswood, spawn("chatswood")) };
const at = (id: MapId, lat: number, lon: number) => place(maps[id], lat, lon, reach[id]);
const isReached = (id: MapId, p: { x: number; y: number }) => reach[id][p.y * maps[id].width + p.x] === 1;

/* ── The world is walkable ──────────────────────────────────────── */

test("the maps are what the generator promises: rows of the declared size", () => {
  for (const map of Object.values(maps)) {
    assert.equal(map.rows.length, map.height);
    for (const row of map.rows) assert.equal(row.length, map.width);
    assert.ok(/^[~.rpgswHhP=tvuABCD]+$/.test(map.rows.join("")), `${map.name} has a tile outside the alphabet`);
  }
});

test("★ every landmark, story character, station, wharf and shard can be walked to", () => {
  const places: [string, MapId, number, number][] = [
    ...LANDMARKS.map((l) => [`landmark ${l.id}`, l.map, l.lat, l.lon] as [string, MapId, number, number]),
    ...STORY_NPCS.map((n) => [`npc ${n.id}`, n.map, n.lat, n.lon] as [string, MapId, number, number]),
    ...SHARDS.map((s) => [`shard ${s.id}`, s.map, s.lat, s.lon] as [string, MapId, number, number]),
    ...PHOTO_SPOTS.map((s) => [`photo ${s.id}`, s.map, s.lat, s.lon] as [string, MapId, number, number]),
    ["station harbour", "harbour", STATIONS.harbour.lat, STATIONS.harbour.lon],
    ["station chatswood", "chatswood", STATIONS.chatswood.lat, STATIONS.chatswood.lon],
    ["wharf quay", "harbour", FERRY_WHARVES.quay.lat, FERRY_WHARVES.quay.lon],
    ["wharf milsons", "harbour", FERRY_WHARVES.milsons.lat, FERRY_WHARVES.milsons.lon],
  ];

  const unreachable = places.filter(([, map, lat, lon]) => !isReached(map, at(map, lat, lon))).map(([name]) => name);
  assert.deepEqual(unreachable, [], `nobody can walk to: ${unreachable.join(", ")}`);
});

test("★ the story's walk exists: Circular Quay → Opera House, and Quay → across the bridge → Milsons Point", () => {
  const quay = spawn("harbour");
  const opera = at("harbour", -33.8575, 151.215);
  const milsons = at("harbour", STATIONS.harbour.lat, STATIONS.harbour.lon);

  assert.ok(findPath(maps.harbour, quay, opera, 1e6), "no walk from the Quay to the Opera House");
  const walk = findPath(maps.harbour, quay, milsons, 1e6);
  assert.ok(walk, "no walk from the Quay to Milsons Point");

  // …and it goes over the bridge, not round some gap in the water.
  assert.ok(walk.some((p) => tileAt(maps.harbour, p.x, p.y) === "H"), "the walk to Milsons Point never touches the bridge deck");
});

test("★ in Chatswood you can get from the station to the mall and to The Avenue", () => {
  const station = spawn("chatswood");
  for (const id of ["mall", "avenue", "concourse"]) {
    const landmark = LANDMARKS.find((l) => l.id === id)!;
    assert.ok(findPath(maps.chatswood, station, at("chatswood", landmark.lat, landmark.lon), 1e6), `no walk from the station to ${id}`);
  }
});

test("the Harbour Bridge is on the map, between its real pylons", () => {
  const bridge = maps.harbour.bridge;
  assert.ok(bridge, "the generator found no pylons");
  // South pylons are south of the north ones, and the deck crosses water.
  assert.ok(bridge.south[1] > bridge.north[1]);
  const mid = { x: Math.floor((bridge.south[0] + bridge.north[0]) / 2), y: Math.floor((bridge.south[1] + bridge.north[1]) / 2) };
  const row = maps.harbour.rows[mid.y];
  assert.ok(row.includes("H") && row.includes("~"), "mid-span row has no deck over water");
});

test("the T1 runs the real stops in the real order", () => {
  assert.deepEqual([...T1_STOPS], ["Milsons Point", "North Sydney", "Waverton", "Wollstonecraft", "St Leonards", "Artarmon", "Chatswood"]);
});

test("Thursday is Sydney's Thursday, not the viewer's", () => {
  // 2026-09-24 was a Thursday in Sydney. 23:30 UTC on the Wednesday is
  // already 09:30 Thursday there.
  assert.equal(isSydneyThursday(new Date("2026-09-23T23:30:00Z")), true);
  // 14:30 UTC on the Thursday is 00:30 Friday in Sydney.
  assert.equal(isSydneyThursday(new Date("2026-09-24T14:30:00Z")), false);
});

/* ── The save survives anything ─────────────────────────────────── */

test("a corrupt save falls back instead of breaking the game", () => {
  const fallback = newSave("harbour", 10, 10);
  for (const raw of [null, "", "{", "[]", "null", '{"v":2}', '"text"']) {
    assert.deepEqual(parseSave(raw, fallback), fallback, `did not fall back for ${raw}`);
  }
});

test("a save is read field by field: bad fields go, good ones stay", () => {
  const fallback = newSave("harbour", 10, 10);
  const parsed = parseSave(
    JSON.stringify({
      v: 1,
      map: "atlantis",
      x: -5,
      y: 12,
      look: { skin: 99, hair: 2, pet: 3 },
      flags: ["talked:deckhand", 7, "x".repeat(200)],
      critters: ["ibis", "dropbear"],
      idea: "crypto",
      streak: 4,
      lastDay: "yesterday",
    }),
    fallback,
  );
  assert.equal(parsed.map, "harbour");
  assert.equal(parsed.x, 10);
  assert.equal(parsed.y, 12);
  assert.equal(parsed.look.skin, DEFAULT_LOOK.skin);
  assert.equal(parsed.look.hair, 2);
  assert.equal(parsed.look.pet, 3);
  assert.deepEqual(parsed.flags, ["talked:deckhand"]);
  assert.deepEqual(parsed.critters, ["ibis"]);
  assert.equal(parsed.idea, null);
  assert.equal(parsed.streak, 4);
  assert.equal(parsed.lastDay, null);
});

test("★ no chapter asks for something that is not in the world today", () => {
  const save = newSave("harbour", 0, 0);

  // An empty wall: the chapter that needs members asks for none.
  const empty = questProgress(save, { members: 0, stalls: 1, questions: 3 });
  const people = empty.find((q) => q.id === "people")!;
  assert.equal(people.need, 0);
  assert.equal(people.done, true);

  // Two members: it asks for two, not three.
  const two = questProgress(save, { members: 2, stalls: 5, questions: 9 });
  assert.equal(two.find((q) => q.id === "people")!.need, 2);
  assert.equal(two.find((q) => q.id === "wharf")!.need, 3);
});

test("the story points at the first unfinished chapter, and nothing is locked behind it", () => {
  let save = newSave("harbour", 0, 0);
  const counts = { members: 5, stalls: 5, questions: 5 };
  assert.equal(currentQuest(questProgress(save, counts))?.id, "arrive");

  // Riding to Chatswood before talking to anybody still counts.
  save = { ...save, flags: ["rode:t1"] };
  const progress = questProgress(save, counts);
  assert.equal(progress.find((q) => q.id === "train")!.done, true);
  assert.equal(currentQuest(progress)?.id, "arrive");

  save = {
    ...save,
    flags: ["rode:t1", "talked:deckhand", "talked:host"],
    idea: "app",
    read: ["1", "2", "3"],
    stamps: ["milsons"],
    stalls: ["a", "b", "c"],
    met: ["x", "y", "z"],
  };
  assert.equal(currentQuest(questProgress(save, counts)), null);
});

test("hats unlock from what was done, and only from that", () => {
  const save = newSave("harbour", 0, 0);
  const counts = { members: 3, stalls: 3, questions: 3 };
  assert.deepEqual(unlockedHats(save, questProgress(save, counts)), ["none"]);

  const done = { ...save, idea: "shop" as const, stamps: Array.from({ length: 8 }, (_, i) => `s${i}`), streak: 3 };
  const hats = unlockedHats(done, questProgress(done, counts));
  assert.ok(hats.includes("bucket") && hats.includes("akubra") && hats.includes("jacaranda"));
  assert.ok(!hats.includes("sail") && !hats.includes("lime"));
  assert.equal(TOTALS.shards, SHARDS.length);
});

test("the daily streak counts consecutive Sydney days and resets on a gap", () => {
  const save = { ...newSave("harbour", 0, 0), streak: 2, lastDay: "2026-09-24" };
  assert.equal(touchStreak(save, "2026-09-24"), save, "same day must be the same object");
  assert.equal(touchStreak(save, "2026-09-25").streak, 3);
  assert.equal(touchStreak(save, "2026-09-27").streak, 1);
  // Across a month boundary.
  assert.equal(touchStreak({ ...save, lastDay: "2026-09-30" }, "2026-10-01").streak, 3);
});

/* ── The wire ───────────────────────────────────────────────────── */

test("a look is always drawable, whatever arrives", () => {
  assert.deepEqual(clampLook(null), DEFAULT_LOOK);
  assert.deepEqual(clampLook("red"), DEFAULT_LOOK);
  assert.equal(clampLook({ top: 3.5 }).top, DEFAULT_LOOK.top);
  assert.equal(clampLook({ pet: -1 }).pet, -1);
  assert.equal(clampLook({ pet: -2 }).pet, DEFAULT_LOOK.pet);
});

test("a move is validated field by field, and free text never gets through", () => {
  const good = { id: "abcdef0123456789", key: "k".repeat(32), map: "harbour", x: 10.123, y: 5, dir: 2, look: {}, emote: "wave" };
  const parsed = parseMove(good);
  assert.ok(parsed);
  assert.equal(parsed.x, 10.12);
  assert.equal(parsed.emote, "wave");

  assert.equal(parseMove({ ...good, id: "../../etc" }), null);
  assert.equal(parseMove({ ...good, key: "short" }), null);
  assert.equal(parseMove({ ...good, map: "moon" }), null);
  assert.equal(parseMove({ ...good, x: Number.NaN }), null);
  assert.equal(parseMove({ ...good, y: 9999 }), null);
  // An emote is one of a fixed set; anything else is dropped, not relayed.
  assert.equal(parseMove({ ...good, emote: "<script>hi</script>" })!.emote, null);
  // Unknown fields do not ride along.
  assert.ok(!("name" in parseMove({ ...good, name: "anyone" })!));
});

test("★ the room never broadcasts a key or a member id", () => {
  resetRoom();
  const member = join({ memberId: "42", name: "Alex", slug: "alex" })!;
  const guest = join({ memberId: null, name: null, slug: null })!;
  assert.ok(member && guest);
  assert.equal(member.guest, null);
  assert.ok(guest.guest && guest.guest[0] >= 0);

  const base = { map: "harbour", x: 3, y: 4, dir: 0 as const, look: DEFAULT_LOOK, emote: null };
  assert.equal(move({ id: member.id, key: member.key, ...base }), true);
  assert.equal(move({ id: guest.id, key: guest.key, ...base }), true);

  const text = snapshot();
  assert.ok(!text.includes(member.key) && !text.includes(guest.key), "a key went out in the snapshot");
  assert.ok(!text.includes('"memberId"') && !text.includes('"42"'), "a member id went out in the snapshot");

  const peers = JSON.parse(text).peers;
  assert.equal(peers.length, 2);
  assert.equal(peers.find((p: { id: string }) => p.id === member.id).slug, "alex");
  resetRoom();
});

test("a move needs the key that came with the seat", () => {
  resetRoom();
  const seat = join({ memberId: null, name: null, slug: null })!;
  const base = { map: "harbour", x: 3, y: 4, dir: 0 as const, look: DEFAULT_LOOK, emote: null };
  assert.equal(move({ id: seat.id, key: "wrong".repeat(5), ...base }), false);
  assert.equal(move({ id: "nobody00000000", key: seat.key, ...base }), false);
  leave(seat.id, "wrong");
  assert.equal(move({ id: seat.id, key: seat.key, ...base }), true, "a wrong key must not be able to remove a player");
  leave(seat.id, seat.key);
  assert.equal(move({ id: seat.id, key: seat.key, ...base }), false);
  resetRoom();
});

test("a seat that floods moves is throttled, not trusted", () => {
  resetRoom();
  const seat = join({ memberId: null, name: null, slug: null })!;
  const base = { map: "harbour", dir: 0 as const, look: DEFAULT_LOOK, emote: null };
  assert.equal(move({ id: seat.id, key: seat.key, x: 1, y: 1, ...base }), true);
  // Straight after: accepted but dropped — the position does not change.
  assert.equal(move({ id: seat.id, key: seat.key, x: 9, y: 9, ...base }), true);
  assert.equal(JSON.parse(snapshot()).peers[0].x, 1);
  assert.ok(MIN_MOVE_MS <= 150, "the throttle must stay under the client's own send interval");
  resetRoom();
});

test("a member opening a second tab replaces the first; the room has a ceiling", () => {
  resetRoom();
  const first = join({ memberId: "7", name: "Sam", slug: "sam" })!;
  const second = join({ memberId: "7", name: "Sam", slug: "sam" })!;
  const base = { map: "harbour", x: 3, y: 4, dir: 0 as const, look: DEFAULT_LOOK, emote: null };
  assert.equal(move({ id: first.id, key: first.key, ...base }), false);
  assert.equal(move({ id: second.id, key: second.key, ...base }), true);

  resetRoom();
  for (let i = 0; i < MAX_PLAYERS; i += 1) assert.ok(join({ memberId: null, name: null, slug: null }));
  assert.equal(join({ memberId: null, name: null, slug: null }), null);
  resetRoom();
});

/* ── Copy and privacy ───────────────────────────────────────────── */

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]).sort(([a], [b]) => String(a).localeCompare(String(b))));
  }
  return typeof value;
}

test("the English copy has exactly the Chinese copy's shape", () => {
  assert.deepEqual(shape(GAME_COPY.en), shape(GAME_COPY.zh));
});

test("every landmark and critter has words in both languages", () => {
  for (const lang of ["zh", "en"] as const) {
    const c = GAME_COPY[lang];
    for (const l of LANDMARKS) assert.ok(c.landmarks[l.id as keyof typeof c.landmarks]?.name, `${lang} has no name for ${l.id}`);
  }
  assert.equal(fill("{a} and {b}", { a: 1 }), "1 and {b}");
});

test("★ nothing in the game's words names a price or an amount of money", () => {
  // AGENTS.md: anything touching money is not this repo's call, and the game
  // is a public page. A dollar figure in a dialogue line would be a pricing
  // statement made by a pixel character.
  const text = JSON.stringify(GAME_COPY);
  assert.ok(!/[$¥￥]\s?\d|\d\s?(澳元|元|AUD|dollars?)/i.test(text), "the game copy mentions money");
});

test("★ /play reads the database through the public pages' own two gates, and nothing else", () => {
  const page = readFileSync(path.join(root, "src/app/play/page.tsx"), "utf8");
  const fromDb = page.match(/import \{([^}]+)\} from "@\/lib\/db"/)?.[1].split(",").map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(fromDb?.sort(), ["listWallMembers", "listWharfQuestions"]);
  assert.ok(!page.includes("getPool"), "the game page queries the database directly");
});

/* ── Side quests, dailies, quick chat ───────────────────────────── */

test("every side quest has a giver in the world and words in both languages", () => {
  for (const quest of SIDE_QUESTS) {
    assert.ok(STORY_NPCS.some((npc) => npc.id === quest.giver), `${quest.id}'s giver ${quest.giver} is not placed`);
    for (const lang of ["zh", "en"] as const) {
      assert.ok(GAME_COPY[lang].side.quests[quest.id].title, `${lang} has no title for ${quest.id}`);
      assert.ok((GAME_COPY[lang].npc as Record<string, { offer?: string[] }>)[quest.giver]?.offer?.length, `${lang} has no offer for ${quest.giver}`);
    }
  }
  // Every one of the story's people has a line to call out, even if empty.
  for (const npc of STORY_NPCS) assert.ok(npc.id in GAME_COPY.zh.barks, `no bark for ${npc.id}`);
});

test("a side quest is ready only once accepted and met, and done only once turned in", () => {
  const counts = { members: 5, stalls: 3, questions: 3 };
  let save = newSave("harbour", 0, 0);
  assert.equal(sideProgress(save, counts).find((q) => q.id === "gday")!.accepted, false);

  save = { ...save, greeted: 5 };
  assert.deepEqual(readyToFinish(sideProgress(save, counts)), [], "met but not accepted is not ready");

  save = { ...save, flags: ["side:gday"] };
  assert.deepEqual(readyToFinish(sideProgress(save, counts)), ["gday"]);

  save = { ...save, flags: ["side:gday", "sidedone:gday"] };
  assert.deepEqual(readyToFinish(sideProgress(save, counts)), []);
  assert.ok(unlockedHats(save, questProgress(save, counts)).includes("koala"));
});

test("the coffee run never asks for more cups than there are members", () => {
  const save = newSave("harbour", 0, 0);
  assert.equal(sideProgress(save, { members: 1, stalls: 1, questions: 3 }).find((q) => q.id === "coffee")!.need, 1);
  assert.equal(sideProgress(save, { members: 9, stalls: 1, questions: 3 }).find((q) => q.id === "coffee")!.need, 3);
});

test("the day's three tasks are the same for everyone, distinct, and skip members when there are none", () => {
  const counts = { members: 0, stalls: 1, questions: 3 };
  for (const day of ["2026-09-25", "2026-09-26", "2026-10-01", "2027-01-01"]) {
    const a = dailyTasks(day, counts);
    assert.deepEqual(a, dailyTasks(day, counts), "not deterministic");
    assert.equal(a.length, 3);
    assert.equal(new Set(a.map((t) => t.kind)).size, 3, "a kind repeated");
    assert.ok(!a.some((t) => t.kind === "member"));
    for (const t of a) if (t.kind === "landmark") assert.ok(LANDMARKS.some((l) => l.id === t.landmark));
  }
});

test("a day's tasks do not reshuffle when the member count changes", () => {
  for (let d = 1; d <= 30; d += 1) {
    const iso = new Date(Date.UTC(2026, 9, d)).toISOString().slice(0, 10);
    const none = dailyTasks(iso, { members: 0, stalls: 1, questions: 3 });
    const some = dailyTasks(iso, { members: 4, stalls: 1, questions: 3 });
    // Identical except where the member task was swapped for its stand-in.
    const differ = none.filter((t, i) => t.kind !== some[i].kind);
    assert.ok(differ.length <= 1, `${iso} reshuffled`);
    if (differ.length) assert.equal(some[none.indexOf(differ[0])].kind, "member");
  }
});

test("a daily task counts up to its target once, pays one star, and resets the next day", () => {
  const counts = { members: 3, stalls: 1, questions: 3 };
  // Find a day whose tasks include greeting (need 3).
  let day = "";
  for (let d = 1; d <= 60 && !day; d += 1) {
    const iso = new Date(Date.UTC(2026, 9, d)).toISOString().slice(0, 10);
    if (dailyTasks(iso, counts).some((t) => t.kind === "greet")) day = iso;
  }
  assert.ok(day, "no day in two months asks for greetings");

  let save = newSave("harbour", 0, 0);
  for (let i = 0; i < 5; i += 1) save = bumpDaily(save, "greet", day, counts);
  assert.equal(save.stars, 1);
  assert.equal(dailyProgress(save, day, counts).find((t) => t.kind === "greet")!.have, 3);

  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const tomorrow = next.toISOString().slice(0, 10);
  assert.equal(dailyProgress(save, tomorrow, counts).every((t) => t.have === 0), true, "yesterday's counts leaked into today");
});

test("quick-chat phrases go over the wire as ids; the new save fields survive garbage", () => {
  const good = { id: "abcdef0123456789", key: "k".repeat(32), map: "harbour", x: 1, y: 1, dir: 0, look: {} };
  for (const phrase of PHRASES) assert.equal(parseMove({ ...good, emote: phrase })!.emote, phrase);
  for (const lang of ["zh", "en"] as const) for (const phrase of PHRASES) assert.ok(GAME_COPY[lang].phrases[phrase]);

  const parsed = parseSave(
    JSON.stringify({ v: 1, greeted: -3, highFives: 2, friends: ["A", 3], daily: { day: "x", progress: { greet: 2, hack: 9 } }, stars: 1.5 }),
    newSave("harbour", 1, 1),
  );
  assert.equal(parsed.greeted, 0);
  assert.equal(parsed.highFives, 2);
  assert.deepEqual(parsed.friends, ["A"]);
  assert.deepEqual(parsed.daily, { day: null, progress: { greet: 2 } });
  assert.equal(parsed.stars, 0);
});

test("the four music tracks exist and stay small enough for a phone", () => {
  for (const track of ["title", "harbour", "chatswood", "train"]) {
    const file = path.join(root, "public/audio/play", `${track}.mp3`);
    const size = readFileSync(file).length;
    assert.ok(size > 200_000 && size < 3_000_000, `${track}.mp3 is ${size} bytes`);
  }
});
