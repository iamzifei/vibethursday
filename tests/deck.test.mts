/**
 * Guards on the deck the room follows on their phones.
 *
 * Everything here is pure: the page number arithmetic, the presenter key
 * comparison, and the in-process listener set. The parts that need Postgres
 * are exercised by actually presenting something, which is the only way to
 * test the thing that matters anyway — whether a table of phones turns.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clampIndex,
  isDeckCode,
  keyMatches,
  newDeckCode,
  newPresenterKey,
  publish,
  subscribe,
} from "../src/lib/deck.ts";
import { copy } from "../src/lib/content.ts";

test("a room code is four digits, so it can be read across a table", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = newDeckCode();
    assert.match(code, /^\d{4}$/, `generated a code that cannot be read out: ${code}`);
    assert.ok(isDeckCode(code));
  }
});

test("anything that is not four digits is not a room", () => {
  // The viewer page puts this in front of a database lookup, so it is also
  // what stops a path segment from becoming a query.
  for (const value of ["", "12", "12345", "12a4", "../1", null, undefined]) {
    assert.equal(isDeckCode(value as string | null | undefined), false, `accepted ${value}`);
  }
});

test("a presenter key only matches itself", () => {
  const key = newPresenterKey();

  assert.equal(keyMatches(key, key), true);
  assert.equal(keyMatches(key, newPresenterKey()), false);
  // A different length must be rejected rather than throw: `timingSafeEqual`
  // does throw on mismatched lengths, and an exception here would surface as a
  // 500 on a page anyone can request with any key.
  assert.equal(keyMatches("short", key), false);
  assert.equal(keyMatches(undefined, key), false);
  assert.equal(keyMatches(key, undefined), false);
});

test("a page number is held inside the deck it belongs to", () => {
  assert.equal(clampIndex(5, 3), 2);
  assert.equal(clampIndex(-1, 3), 0);
  assert.equal(clampIndex(1, 3), 1);
  // ★ An empty deck is the state a room sits in while the presenter is still
  // uploading, and it is reachable by anyone who scans the code early. Page
  // "-1" would render a slide URL that 404s behind a broken image icon.
  assert.equal(clampIndex(0, 0), 0);
  assert.equal(clampIndex(3, 0), 0);
  assert.equal(clampIndex(Number.NaN, 5), 0);
});

test("a page turn reaches every phone in that room and no other", () => {
  const here: number[] = [];
  const alsoHere: number[] = [];
  const elsewhere: number[] = [];

  const offA = subscribe("1111", (state) => here.push(state.index));
  const offB = subscribe("1111", (state) => alsoHere.push(state.index));
  const offC = subscribe("2222", (state) => elsewhere.push(state.index));

  publish("1111", { index: 4, slideCount: 9, rev: 0 });

  assert.deepEqual(here, [4]);
  assert.deepEqual(alsoHere, [4]);
  assert.deepEqual(elsewhere, [], "a turn leaked into another room");

  offA();
  publish("1111", { index: 5, slideCount: 9, rev: 0 });

  assert.deepEqual(here, [4], "a phone that left kept receiving turns");
  assert.deepEqual(alsoHere, [4, 5]);

  offB();
  offC();
});

test("★ one broken phone does not stop the turn reaching the rest of the table", () => {
  // This is the whole room's screen. A viewer whose stream died between the
  // last heartbeat and this turn must not be able to freeze everyone else's.
  const survived: number[] = [];

  const offBroken = subscribe("3333", () => {
    throw new Error("this stream is gone");
  });
  const offFine = subscribe("3333", (state) => survived.push(state.index));

  publish("3333", { index: 2, slideCount: 4, rev: 0 });

  assert.deepEqual(survived, [2]);

  offBroken();
  offFine();
});

test("publishing into a room nobody is watching is not an error", () => {
  // The ordinary case for the first page turn of any talk: the presenter
  // starts before anyone has finished scanning.
  assert.doesNotThrow(() => publish("9999", { index: 0, slideCount: 3, rev: 0 }));
});

test("both languages describe the deck with the same keys", () => {
  // The two bundles are hand-maintained side by side and the English page
  // would render `undefined` for anything added to only one of them.
  assert.deepEqual(
    Object.keys(copy.zh.deck).sort(),
    Object.keys(copy.en.deck).sort(),
    "zh and en deck copy have drifted apart",
  );
});

test("the copy that carries numbers keeps its placeholders", () => {
  // Each of these is substituted with `.replace()`, which fails silently: a
  // renamed placeholder shows the literal `{n}` on screen rather than throwing.
  const REQUIRED: Array<[keyof typeof copy.zh.deck, string[]]> = [
    ["page", ["{n}", "{total}"]],
    ["adding", ["{done}", "{total}"]],
    ["slideCount", ["{n}"]],
    ["viewers", ["{n}"]],
    ["tooMany", ["{n}"]],
  ];

  for (const lang of ["zh", "en"] as const) {
    for (const [key, tokens] of REQUIRED) {
      const value = copy[lang].deck[key];
      assert.equal(typeof value, "string", `${lang}.deck.${String(key)} is not a string`);

      for (const token of tokens) {
        assert.ok(
          (value as string).includes(token),
          `${lang}.deck.${String(key)} lost ${token}`,
        );
      }
    }
  }
});
