/**
 * The Wharf.
 *
 * Two kinds of thing are pinned down here, and only one of them is logic.
 *
 * The first is the privacy boundary, and it is the reason this file exists.
 * The sign-up form makes a specific promise about the "what do you most want
 * to ask" field: it appears on the member wall *if you tick the box*. A page
 * that gathers those sentences up and publishes them is one careless query
 * away from breaking that promise for everyone who did not tick it, and no
 * type error and no failing render would ever say so. So the test is on the
 * source: this page is allowed exactly one way to reach the database.
 *
 * The second is the session-attribution rule, which is subtle for the reason
 * explained in `topicSession`: `sessions` accumulates and `topic` does not.
 * The board's own logic — lanes and states — lives in questions.test.mts.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";
import { gullMood, topicSession } from "../src/lib/wharf.ts";
import { countByStage, listWorks } from "../src/lib/works.ts";

/**
 * Source with the comments taken out.
 *
 * The check below is a substring search, and a substring search cannot tell
 * code from prose. Each of these pages carries a comment explaining *why* it
 * does not call `listSignups`, and that sentence was enough to fail the test
 * it was describing. Stripping first means a page can go on documenting its
 * own rule.
 *
 * Only whole-line `//` comments are removed, never trailing ones: a URL in a
 * string literal contains `//` and taking everything after it would quietly
 * delete real code from what is being inspected.
 */
function code(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const wharfPage = code("src/app/wharf/page.tsx");
const homePage = code("src/app/page.tsx");
const sessionsPage = code("src/app/sessions/page.tsx");

// ── The promise the sign-up form made ───────────────────────────────

test("the Wharf can only read published, unhidden cards", () => {
  // `listWallMembers` filters on `published_at IS NOT NULL AND NOT hidden` in
  // SQL. Anything else — listSignups, a query of its own, the admin helpers —
  // would put sentences on a public page from people who never agreed to it.
  // Two allowed doors now, and both filter on published_at in SQL:
  // listWallMembers for cards, listWharfQuestions for questions — the latter
  // joins members and applies the same WHERE.
  for (const [name, source] of [
    ["/wharf", wharfPage],
    ["the home page's Wharf block", homePage],
    ["/sessions", sessionsPage],
  ] as const) {
    assert.ok(
      source.includes("listWallMembers") || source.includes("listWharfQuestions"),
      `${name} must get its rows through a query that filters on published_at`,
    );

    // `countSignups` is allowed and `listSignups` is not, and the difference
    // is the whole point: one returns a number, the other returns a table of
    // names, emails and WeChat IDs. A public page may have the number.
    for (const forbidden of ["listSignups", "listAllMembers", "getPool", "SELECT "]) {
      assert.ok(
        !source.includes(forbidden),
        `${name} reaches the database through ${forbidden}, which does not filter on published_at`,
      );
    }
  }
});


// ── Which session a sentence belongs to ─────────────────────────────

test("a topic belongs to the latest session its author signed up for", () => {
  // `signups.topic` is overwritten on every re-signup while `sessions` grows,
  // so a regular has one sentence and four dates. Filing it under an earlier
  // date would put words in their mouth about a week they wrote nothing for.
  assert.equal(topicSession(["2026-08-13", "2026-08-27", "2026-08-20"]), "2026-08-27");
  assert.equal(topicSession([]), null);
  assert.equal(topicSession(["2026-08-06"]), "2026-08-06");
});








// ── The bird ────────────────────────────────────────────────────────

test("the gull reports the page it is standing on", () => {
  assert.equal(gullMood(3, 9), "waiting");
  assert.equal(gullMood(0, 9), "quiet");
  assert.equal(gullMood(0, 0), "empty");
});

test("both languages have every line the Wharf renders", () => {
  for (const lang of ["zh", "en"] as const) {
    const w = copy[lang].wharf;

    for (const key of ["title", "lede", "place", "thisWeek", "noSession", "emptyWeek"] as const) {
      assert.ok(w[key]?.trim(), `${lang} has no wharf.${key}`);
    }

    // Each of these three is a sentence with a number substituted into it.
    assert.ok(w.say.waiting.includes("{n}"), `${lang}'s waiting line has no count in it`);
    assert.ok(w.older.includes("{n}") && w.older.includes("{m}"), `${lang}'s older line`);
    assert.ok(copy[lang].wharfTeaser.count.includes("{n}"), `${lang}'s teaser count`);
    assert.ok(copy[lang].members.topicOn.includes("{date}"), `${lang}'s dated topic label`);
  }
});

// ── The numbering nobody will remember to update ────────────────────

test("the home page's section numbers are 01..N with no gaps or repeats", () => {
  // Inserting a section means renumbering every one below it, by hand, in two
  // languages. Getting that wrong produces two § 05s or a missing § 06, which
  // no build and no type will ever complain about.
  const numbers = (lang: "zh" | "en"): number[] => {
    const found: number[] = [];

    const walk = (value: unknown): void => {
      if (typeof value === "string") {
        const match = value.match(/^§ (\d+) —/);
        if (match) found.push(Number(match[1]));
      } else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };

    walk(copy[lang]);
    return found.sort((a, b) => a - b);
  };

  for (const lang of ["zh", "en"] as const) {
    const found = numbers(lang);
    assert.ok(found.length > 0, `${lang} has no numbered sections`);
    assert.deepEqual(
      found,
      found.map((_, index) => index + 1),
      `${lang}'s section numbers are ${found.join(", ")}`,
    );
  }
});

// ── Works ───────────────────────────────────────────────────────────

test("a placeholder is not a work", () => {
  // Somebody typed a hyphen into a required field to get past it. That is a
  // legible thing on their own card and a broken row on a page of everything
  // the room has built.
  const wall = [
    {
      slug: "a",
      display_name: "A",
      topic: null,
      sessions: [],
      assets: [
        { kind: "product", title: "-", tagline: "-", url: null, stage: "revenue" },
        { kind: "product", title: "影笺", tagline: null, url: null, stage: "local" },
        { kind: "media", title: "小红书", tagline: null, url: null, stage: null },
      ],
    },
  ];

  assert.deepEqual(
    listWorks(wall).map((work) => work.title),
    ["影笺"],
  );
  // Counting has to agree with listing, or the filter chip promises a row
  // that is not there.
  assert.equal(countByStage(wall).get("revenue"), undefined);
});

test("★ editing is guarded in the UPDATE, not in the caller", () => {
  // Ownership, not-closed and nothing-attached are all in the WHERE. Checked in
  // TypeScript they would be checks two concurrent requests can both pass, and
  // the one that matters protects somebody else's answer.
  const db = readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf8");
  const fn = db.slice(db.indexOf("export async function editQuestion"));
  const body = fn.slice(0, fn.indexOf("\n}"));

  assert.match(body, /member_id = \$2/, "must check ownership");
  assert.match(body, /closed_at IS NULL/, "must refuse a closed question");
  assert.match(body, /NOT EXISTS[\s\S]{0,90}wharf_replies/, "must refuse once anyone has replied");
  assert.match(body, /coalesce\(q\.original_text, q\.text\)/, "must keep the FIRST wording");
});

test("★ the sign-up sync will not resurrect an edited question's original", () => {
  // ⚠️ Measured, not assumed: without this the dedupe index (on md5(text)) no
  // longer recognises the row it made, and one edit puts the old sentence back
  // on the board beside the new one.
  const db = readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf8");
  const sync = db.slice(db.indexOf("async function syncQuestionsFromSignups"));
  const query = sync.slice(0, sync.indexOf("if (candidates.rows.length"));

  assert.match(query, /original_text = btrim\(g\.topic\)/);
});

test("★ an edited question says so, in every language", () => {
  // /wharf tells readers the questions are printed exactly as written. The
  // exceptions have to be able to contradict that, or the sentence is a lie.
  for (const lang of ["zh", "en"] as const) {
    assert.ok(copy[lang].wharf.edited.trim().length > 0);
  }
});
