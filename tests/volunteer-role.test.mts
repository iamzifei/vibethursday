/**
 * 志愿者 (2026-11-02): someone who helps run the day, given the role by the
 * organiser, comes to Build Tuesday free like the 导师团 — but the role is
 * not shown on public cards, and the desk says which one it is.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { isRoleKind, ROLE_LABEL } from "../src/lib/person-roles.ts";
import { buildDesk, deskExportRow, type DeskRow } from "../src/lib/desk.ts";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const row = (over: Partial<DeskRow>): DeskRow => ({
  id: "1", name: "A", wechat: null, booked: true, waitlisted: false, checked_in_at: null, source: null,
  member: false, mentor: false, volunteer: false, builder: false, fee_status: null, paid_via: null, claimed_at: null,
  bring: null, topic: null, building: null, sessions: [], ...over,
});

test("volunteer is a role the organiser can give", () => {
  assert.ok(isRoleKind("volunteer"));
  assert.equal(ROLE_LABEL.volunteer, "志愿者");
  assert.match(read("src/lib/db.ts"), /CHECK \(role IN \('builder', 'mentor', 'volunteer'\)\)/);
});

test("a volunteer owes nothing on a Tuesday, and the desk says why", () => {
  const [entry] = buildDesk([row({ volunteer: true, fee_status: "pending" })], true);
  assert.equal(entry.pay, "volunteer");
  assert.match(deskExportRow(entry)[4], /志愿者/);
});

test("every place that waives the Tuesday fee for mentors also waives it for volunteers", () => {
  const db = read("src/lib/db.ts");
  assert.doesNotMatch(db, /r\.role = 'mentor'\)\s*(AS member|$)/m);
  assert.match(db, /role IN \('mentor', 'volunteer'\)/);
});

test("the volunteer role never shows on a public card", () => {
  for (const file of ["src/components/MemberCard.tsx", "src/app/members/[slug]/page.tsx", "src/app/live/page.tsx"]) {
    assert.doesNotMatch(read(file), /volunteer/);
  }
});

test("the follow-up list does not push membership on a volunteer", () => {
  assert.match(read("src/lib/followup.ts"), /!entry\.volunteer/);
});
