import assert from "node:assert/strict";
import { test } from "node:test";
import { walkInMatches } from "../src/lib/walk-in-match.ts";

/**
 * After a session: people who typed their name at the door (walk-ins) and an
 * earlier signup that is probably the same person (James 2026-10-01). Only a
 * suggestion — the organiser presses merge.
 */

const NOW = new Date("2026-10-01T08:00:00Z");
const row = (id: string, name: string, source: string | null, created_at: string) => ({ id, name, source, created_at });

test("a walk-in is paired with the earlier signup of the same name, however spaced or cased", () => {
  const out = walkInMatches(
    [
      row("10", "Chris Xu", "signup", "2026-09-20T00:00:00Z"),
      row("50", "chris  xu", "walk-in", "2026-10-01T00:30:00Z"),
      row("11", "Lina", "signup", "2026-09-21T00:00:00Z"),
    ],
    NOW,
  );
  assert.deepEqual(out, [{ walkIn: { id: "50", name: "chris  xu" }, candidates: [{ id: "10", name: "Chris Xu" }] }]);
});

test("a short name inside a longer one counts; a single character does not", () => {
  const out = walkInMatches(
    [row("12", "小河姐姐", "signup", "2026-09-20T00:00:00Z"), row("51", "小河", "walk-in", "2026-10-01T00:30:00Z")],
    NOW,
  );
  assert.deepEqual(out[0]?.candidates.map((c) => c.id), ["12"]);
  assert.deepEqual(
    walkInMatches([row("13", "李明", "signup", "2026-09-20T00:00:00Z"), row("52", "李", "walk-in", "2026-10-01T00:30:00Z")], NOW),
    [],
  );
});

test("no match, nothing suggested; walk-ins are never paired with each other", () => {
  assert.deepEqual(
    walkInMatches(
      [row("53", "Amy", "walk-in", "2026-10-01T00:30:00Z"), row("54", "Amy", "walk-in", "2026-10-01T00:40:00Z")],
      NOW,
    ),
    [],
  );
});

test("old walk-ins drop off after two weeks, so a real namesake does not nag forever", () => {
  assert.deepEqual(
    walkInMatches(
      [row("10", "Chris Xu", "signup", "2026-08-01T00:00:00Z"), row("55", "Chris Xu", "walk-in", "2026-09-10T00:00:00Z")],
      NOW,
    ),
    [],
  );
});

test("a two-letter Latin name is not matched inside longer names, only exactly", () => {
  const rows = [
    { id: "14", name: "Alice", source: "signup", created_at: "2026-09-20T00:00:00Z" },
    { id: "15", name: "Al", source: "signup", created_at: "2026-09-20T00:00:00Z" },
    { id: "56", name: "Al", source: "walk-in", created_at: "2026-10-01T00:30:00Z" },
  ];
  assert.deepEqual(walkInMatches(rows, NOW)[0]?.candidates.map((c) => c.id), ["15"]);
});
