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
 * The second is the grouping rule, which is subtle for a reason explained in
 * `topicSession`: `sessions` accumulates and `topic` does not.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { copy } from "../src/lib/content.ts";
import {
  featuredTopics,
  groupTopics,
  gullMood,
  topicSession,
  type TopicSource,
} from "../src/lib/wharf.ts";

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

function person(slug: string, topic: string | null, sessions: string[] = []): TopicSource {
  return { slug, display_name: slug, topic, sessions };
}

// ── The promise the sign-up form made ───────────────────────────────

test("the Wharf can only read published, unhidden cards", () => {
  // `listWallMembers` filters on `published_at IS NOT NULL AND NOT hidden` in
  // SQL. Anything else — listSignups, a query of its own, the admin helpers —
  // would put sentences on a public page from people who never agreed to it.
  for (const [name, source] of [
    ["/wharf", wharfPage],
    ["the home page's Wharf block", homePage],
    ["/sessions", sessionsPage],
  ] as const) {
    assert.ok(
      source.includes("listWallMembers"),
      `${name} must get its rows from listWallMembers()`,
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

test("a member with no topic never reaches the page", () => {
  const { groups, total } = groupTopics(
    [person("a", null, ["2026-09-03"]), person("b", "   ", ["2026-09-03"])],
    "2026-09-03",
  );

  assert.equal(total, 0);
  assert.deepEqual(groups[0].entries, []);
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

test("a regular is listed once, under their most recent session", () => {
  const { groups, total } = groupTopics(
    [person("regular", "how do people find their first paying user?", [
      "2026-08-06",
      "2026-08-13",
      "2026-08-27",
    ])],
    "2026-09-03",
  );

  assert.equal(total, 1);

  const listed = groups.flatMap((group) => group.entries.map(() => group.session));
  assert.deepEqual(listed, ["2026-08-27"]);
});

// ── Grouping ────────────────────────────────────────────────────────

test("this Thursday leads, even with nothing in it", () => {
  // An empty first group is a true statement on a Friday, and it is where the
  // page says how to get your own question up there. Hiding it would delete
  // the ask along with the emptiness.
  const { groups } = groupTopics([person("a", "q", ["2026-08-27"])], "2026-09-03");

  assert.equal(groups[0].session, "2026-09-03");
  assert.deepEqual(groups[0].entries, []);
  assert.equal(groups[1].session, "2026-08-27");
});

test("someone signed up weeks ahead is folded into this Thursday", () => {
  const { groups } = groupTopics(
    [person("keen", "q", ["2026-09-17"]), person("now", "q2", ["2026-09-03"])],
    "2026-09-03",
  );

  assert.equal(groups[0].entries.length, 2);
  assert.equal(groups.length, 1);
});

test("past sessions run newest first and are capped, and the overflow is counted", () => {
  const people = ["2026-08-06", "2026-08-13", "2026-08-20", "2026-08-27"].map((date, index) =>
    person(`p${index}`, `q${index}`, [date]),
  );

  const { groups, olderSessions, olderEntries } = groupTopics(people, "2026-09-03", 2);

  assert.deepEqual(
    groups.map((group) => group.session),
    ["2026-09-03", "2026-08-27", "2026-08-20"],
  );
  // Not silently dropped: the page prints these two numbers.
  assert.equal(olderSessions, 2);
  assert.equal(olderEntries, 2);
});

test("people who can never do Thursday mornings come last, not nowhere", () => {
  // They picked "I can't make any of these" on the form. They are exactly the
  // people the site otherwise loses track of.
  const { groups } = groupTopics(
    [person("cant", "q", []), person("can", "q2", ["2026-09-03"])],
    "2026-09-03",
  );

  assert.equal(groups.at(-1)?.session, null);
  assert.equal(groups.at(-1)?.entries.length, 1);
});

// ── The home page's three ───────────────────────────────────────────

test("the home page falls through to older questions rather than showing none", () => {
  // On a Friday nobody has signed up for the next Thursday yet. Showing an
  // empty block then would make the feature look dead in the week it launched.
  const { groups } = groupTopics(
    [person("a", "q1", ["2026-08-27"]), person("b", "q2", ["2026-08-20"])],
    "2026-09-03",
  );

  assert.deepEqual(
    featuredTopics(groups).map((entry) => entry.topic),
    ["q1", "q2"],
  );
});

test("the home page shows at most three", () => {
  const { groups } = groupTopics(
    ["a", "b", "c", "d"].map((slug) => person(slug, slug, ["2026-09-03"])),
    "2026-09-03",
  );

  assert.equal(featuredTopics(groups).length, 3);
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
