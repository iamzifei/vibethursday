/**
 * Who is who, at a glance (2026-11-02): the member wall sorted and filterable
 * by identity — 导师团, 共建者, 共创会员, everyone else — and the check-in
 * confirm step showing the person's identity. And for someone who signed up
 * but cannot find themselves: a card shows on the wall only once claimed and
 * made public, so the empty search says how.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { IDENTITIES, identityOf, sortByIdentity } from "../src/lib/directory.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const m = (over: Partial<{ id: string; mentor: boolean; builder: boolean; cocreator: boolean }>) => ({ id: "x", mentor: false, builder: false, cocreator: false, ...over });

test("★ one identity per person, the most specific first: mentor, builder, member, everyone else", () => {
  assert.deepEqual([...IDENTITIES], ["mentor", "builder", "cocreator", "member"]);
  assert.equal(identityOf(m({ mentor: true, cocreator: true })), "mentor");
  assert.equal(identityOf(m({ builder: true, cocreator: true })), "builder");
  assert.equal(identityOf(m({ cocreator: true })), "cocreator");
  assert.equal(identityOf(m({})), "member");
});

test("sorting by identity keeps the existing order within each group", () => {
  const sorted = sortByIdentity([m({ id: "a" }), m({ id: "b", cocreator: true }), m({ id: "c", mentor: true }), m({ id: "d" }), m({ id: "e", builder: true })]);
  assert.deepEqual(sorted.map((x) => x.id), ["c", "e", "b", "a", "d"]);
});

test("the wall offers the identity filter, and the empty search points to claiming a card", async () => {
  const page = read("src/app/members/page.tsx");
  assert.match(page, /sortByIdentity\(/);
  assert.match(page, /params\.who/);
  const { copy } = await import("../src/lib/content.ts");
  for (const lang of ["zh", "en"] as const) {
    assert.ok(copy[lang].members.claimHint.length > 0, lang);
    assert.ok(copy[lang].members.identity.mentor.length > 0, lang);
  }
});

test("the check-in confirm step shows who the person is", () => {
  const page = read("src/app/checkin/page.tsx");
  assert.match(page, /who\.identity|identityOf\(/);
  const db = read("src/lib/db.ts");
  const roster = db.slice(db.indexOf("export async function listRoster"));
  assert.match(roster.slice(0, 2000), /AS mentor/);
});
