import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { cardArt, cardNumber, posterCard, rng, SCENES, TINTS } from "../src/lib/poster-card.ts";
import { FIRST_SESSION_DATE } from "../src/lib/sessions.ts";

/**
 * The week's poster is one card in a set (`src/lib/poster-card.ts`).
 *
 * The property worth protecting is that the card is a function of the date and
 * nothing else. Break that and the failure is silent: the poster still draws,
 * still looks fine, and is simply a different picture every time the button is
 * pressed — which is the one thing a numbered collectible cannot be.
 */

const FIRST = "2026-08-06";
const day = 24 * 60 * 60 * 1000;

/** `n` weeks after the launch date, as an ISO date. */
function week(n: number): string {
  return new Date(Date.parse(`${FIRST}T00:00:00Z`) + n * 7 * day).toISOString().slice(0, 10);
}

test("the same Thursday always draws the same card", () => {
  // Drawn on the organiser's phone, drawn again on a laptop, drawn again next
  // year: every field has to match, including the seed.
  for (const n of [0, 1, 7, 20, 51]) {
    assert.deepEqual(posterCard(week(n), FIRST), posterCard(week(n), FIRST));
  }
});

test("the serial counts weeks from the launch date", () => {
  assert.equal(cardNumber(FIRST, FIRST), 1);
  assert.equal(cardNumber(week(1), FIRST), 2);
  // 2026-09-24, the eighth Thursday, which is the one this was written for.
  assert.equal(cardNumber("2026-09-24", FIRST), 8);

  // A date before the meetup existed is never a date a poster is drawn for,
  // but it must not index off the front of the scene list either.
  assert.equal(cardNumber("2026-07-02", FIRST), 1);
  assert.ok(SCENES.includes(posterCard("2026-07-02", FIRST).scene));
});

test("the launch date is the first card under the real configuration", () => {
  // Guards the wiring, not the arithmetic: `posterCard` defaults to the same
  // launch date the rest of the site counts sessions from.
  assert.equal(cardNumber(FIRST_SESSION_DATE), 1);
});

test("consecutive weeks differ in both picture and tint", () => {
  for (let n = 0; n < 30; n += 1) {
    const a = posterCard(week(n), FIRST);
    const b = posterCard(week(n + 1), FIRST);

    assert.notEqual(a.scene.id, b.scene.id, `week ${n} and ${n + 1} share a scene`);
    assert.notEqual(a.tint, b.tint, `week ${n} and ${n + 1} share a tint`);
    assert.equal(b.no, a.no + 1);
  }
});

test("the set comes round only every 21 weeks, and not with the same seed", () => {
  // 7 scenes against 3 tints: the pairing is what makes the cycle long.
  const cycle = SCENES.length * TINTS.length;
  assert.equal(cycle, 21);

  const first = posterCard(week(3), FIRST);
  const later = posterCard(week(3 + cycle), FIRST);

  assert.equal(first.scene.id, later.scene.id);
  assert.equal(first.tint, later.tint);
  // Same picture and ink, different details: the seed is hashed from the date.
  assert.notEqual(first.seed, later.seed);

  // Nothing in between repeats the pair.
  const seen = new Set<string>();
  for (let n = 0; n < cycle; n += 1) {
    const card = posterCard(week(n), FIRST);
    const pair = `${card.scene.id}/${card.tint}`;
    assert.ok(!seen.has(pair), `${pair} repeats inside one cycle`);
    seen.add(pair);
  }
});

test("★ every scene has a picture sitting where it says it does", () => {
  // The failure this catches is silent twice over: a missing plate throws
  // nothing (the poster falls back to bare ink by design), and it only happens
  // on the one week in seven that scene comes round. Nobody would see it until
  // that Thursday, and then only if they looked.
  for (const scene of SCENES) {
    const url = cardArt(scene);
    assert.match(url, /^\/cards\/[a-z]+\.png$/, `odd art path for "${scene.id}": ${url}`);

    const file = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    assert.ok(existsSync(file), `no picture for "${scene.id}" — expected ${file}`);

    // A plate that is a few hundred bytes is a failed generation that got
    // written anyway; a real one is hundreds of KB.
    assert.ok(statSync(file).size > 20_000, `"${scene.id}" picture looks empty`);
  }
});

test("cardArt takes an id as happily as a scene", () => {
  assert.equal(cardArt("harbour"), cardArt(SCENES[0]));
});

test("scene names are distinct in both languages", () => {
  // They are printed on the card as its subject; two cards claiming to be the
  // same picture would make the number the only thing telling them apart.
  assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length);
  assert.equal(new Set(SCENES.map((s) => s.zh)).size, SCENES.length);
  assert.equal(new Set(SCENES.map((s) => s.en)).size, SCENES.length);
});

test("rng is deterministic and stays inside [0, 1)", () => {
  const take = (seed: number) => Array.from({ length: 200 }, () => 0).map(rng(seed));

  // `map` with the generator gives 200 successive draws; two runs of the same
  // seed must agree, or nothing above is reproducible.
  const a = take(12345);
  const b = take(12345);
  assert.deepEqual(a, b);

  for (const value of a) {
    assert.ok(value >= 0 && value < 1, `out of range: ${value}`);
  }

  // A different seed must actually take a different walk, not merely start
  // somewhere else on the same one.
  assert.notDeepEqual(a, take(12346));
});
