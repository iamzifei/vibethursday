/**
 * Guards on the copy that describes how a session actually runs.
 *
 * The format changed after the 2026-08-13 session (an intros round plus timed
 * demos became small tables people move between). Copy describing a format the
 * room no longer runs is worse than no copy: someone reads it, prepares for it,
 * and finds something else. These tests pin the parts of that copy that can
 * drift silently — the stored values behind a relabelled field, and the two
 * languages falling out of step.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";

const LANGS = ["zh", "en"] as const;

test("the demo-intent options keep their stored values after the relabel", () => {
  // The field was relabelled from "want to demo?" to "want to host a table?",
  // which is a real change in what is being asked. The *stored* values must
  // not move with it: `signup-stats.ts` counts `demo_intent === "yes"`, /admin
  // renders that count, and every row already in the database uses these three
  // strings. Relabelling is a copy edit; renaming the values is a migration.
  const EXPECTED = ["yes", "maybe", "listen"];

  for (const lang of LANGS) {
    assert.deepEqual(
      copy[lang].signup.fields.demoOptions.map((option) => option.value),
      EXPECTED,
      `${lang} demoOptions values drifted — /admin counts and stored rows both key off these`,
    );
  }
});

test("both languages describe the same number of steps in the run of show", () => {
  // The two schedules are hand-maintained side by side, so the usual failure is
  // editing one and forgetting the other. A count mismatch is the cheapest
  // signal that happened.
  assert.equal(
    copy.zh.schedule.slots.length,
    copy.en.schedule.slots.length,
    "zh and en run-of-show have different numbers of steps",
  );
});

test("no published copy still promises the retired intros-and-demos format", () => {
  // These are the specific numbers the old format published: a 60-second round
  // of introductions for everyone, and demo slots of five minutes plus five for
  // questions, capped at four people. The 2026-08-13 session showed the timings
  // do not hold — a demo plus its discussion ran past twenty minutes, and a
  // full intros round ate half the available time. Nothing may quote them.
  const RETIRED = [
    /60 秒/,
    /[Ss]ixty seconds/,
    /讲 5 分钟/,
    /最多 4 位/,
    /four people max/i,
    /hard timer/i,
    /硬计时/,
  ];

  for (const lang of LANGS) {
    // The whole language bundle, not just the schedule: the same promise was
    // repeated in the rules and the FAQ, which is how it survived the first
    // edit that was supposed to remove it.
    const bundle = JSON.stringify(copy[lang]);

    for (const pattern of RETIRED) {
      assert.ok(
        !pattern.test(bundle),
        `${lang} copy still describes the retired format: ${pattern}`,
      );
    }
  }
});

test("the signup form explains that the bar for hosting a table is low", () => {
  // Three people ticked "maybe" on 2026-08-13 and none of them hosted; the bar
  // they imagined was higher than the real one. The hint is the only place the
  // form says so, so an empty one is a silent regression.
  for (const lang of LANGS) {
    const hint = copy[lang].signup.fields.demoIntentHint;

    assert.ok(
      typeof hint === "string" && hint.trim().length > 0,
      `${lang} is missing the hint that lowers the bar for hosting a table`,
    );
  }
});

/**
 * ★ The share cards carry the same promises, and nothing was checking them.
 *
 * The test above scans the copy bundle. The pictures that get pasted into
 * WeChat, Xiaohongshu and X do not live there — their words are baked into
 * `art/*.html` and `scripts/build-og.sh`, rendered to PNG once and committed.
 *
 * That gap is not hypothetical. 2026-09-24: both Chinese cards were still
 * advertising 悉尼 CBD and 10:00–13:00 — the venue and the hours from before
 * the move — and all three still promised 讲 5 分钟, a format retired on
 * 2026-08-13. They had been wrong for six weeks while every test passed,
 * because the only thing that ever checked those sentences was somebody
 * looking at the picture.
 */

/** Every file whose words end up inside a shared image. */
function cardSources(): { name: string; text: string }[] {
  const art = path.join(process.cwd(), "art");

  return [
    ...readdirSync(art)
      .filter((file) => file.endsWith(".html"))
      .map((file) => ({ name: `art/${file}`, text: readFileSync(path.join(art, file), "utf8") })),
    {
      name: "scripts/build-og.sh",
      text: readFileSync(path.join(process.cwd(), "scripts/build-og.sh"), "utf8"),
    },
  ];
}

test("★ no share card still promises the retired format", () => {
  const RETIRED = [/60 秒/, /讲 5 分钟/, /最多 4 位/, /four people max/i, /hard timer/i, /硬计时/];

  for (const { name, text } of cardSources()) {
    for (const pattern of RETIRED) {
      assert.ok(!pattern.test(text), `${name} still describes the retired format: ${pattern}`);
    }
  }
});

test("★ every share card names the venue and the opening time the site names", () => {
  // Derived from the home page's own fact cards rather than written out here,
  // so the next move only has to be made in one place — and the day it is
  // made, any card that was not re-rendered fails this.
  const facts = copy.zh.hero.facts;
  const venue = facts.find((fact) => fact.href?.includes("maps.google"))?.value ?? "";
  const time = facts.find((fact) => fact.label === "时间")?.value ?? "";

  // "The Avenue · Chatswood" → ["The Avenue", "Chatswood"]; the cards set the
  // two on separate lines, so the whole string never appears verbatim.
  const parts = venue.split("·").map((part) => part.trim()).filter(Boolean);
  const hour = time.match(/\d{1,2}:\d{2}/)?.[0] ?? "";

  assert.ok(parts.length > 0 && hour, "could not read the venue and hour out of the home page facts");

  for (const { name, text } of cardSources()) {
    // A card that names no venue at all is fine — some are pure typography.
    // A card that names one has to name this one.
    if (!/地点|Where/i.test(text)) continue;

    for (const part of parts) {
      assert.ok(text.includes(part), `${name} does not name the venue (missing "${part}")`);
    }

    assert.ok(text.includes(hour), `${name} does not carry the opening time ${hour}`);
  }
});
