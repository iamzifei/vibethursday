/**
 * The follow-up list after a session (2026-11-02):
 * who came, grouped by what to do next — a need to take on, a project that
 * could use a 共建者, someone studying for the certificate, a regular who is
 * not yet a 共创会员, a first-timer. Rules, not guesses; only people who came.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { buildDesk, type DeskRow } from "../src/lib/desk.ts";
import { followUps } from "../src/lib/followup.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const row = (over: Partial<DeskRow>): DeskRow => ({
  id: "1", name: "A", wechat: "a", booked: true, waitlisted: false, checked_in_at: "10:40", source: "qr",
  member: false, mentor: false, builder: false, fee_status: "paid", paid_via: "card", claimed_at: null, bring: null, topic: null,
  building: null, sessions: [], ...over,
});

test("★ each person who came gets the follow-ups that apply to them", () => {
  const session = "2026-11-10";
  const desk = buildDesk(
    [
      row({ id: "1", bring: "need", topic: "餐馆排班", sessions: ["2026-11-10"] }),
      row({ id: "2", bring: "project", sessions: ["2026-10-01", "2026-11-10"] }),
      row({ id: "3", bring: "cert", member: true, sessions: ["2026-11-03", "2026-11-10"] }),
      // Two Tuesdays in 30 days, not a member: worth offering the membership.
      row({ id: "4", sessions: ["2026-10-27", "2026-11-03", "2026-11-10"] }),
      // Did not come: nothing.
      row({ id: "5", bring: "need", checked_in_at: null, source: null, sessions: ["2026-11-10"] }),
    ],
    true,
  );
  const byId = Object.fromEntries(followUps(desk, session).map((item) => [item.entry.id, item.actions]));
  assert.deepEqual(byId["1"], ["need", "first"]);
  assert.deepEqual(byId["2"], ["project"]);
  assert.deepEqual(byId["3"], ["cert"], "a member is never offered the membership");
  assert.deepEqual(byId["4"], ["membership"]);
  assert.equal(byId["5"], undefined, "only people who came");
});

test("a builder is not asked to become one; a mentor is not offered the membership", () => {
  const desk = buildDesk(
    [
      row({ id: "1", bring: "project", builder: true, sessions: ["2026-10-01", "2026-11-10"] }),
      row({ id: "2", mentor: true, sessions: ["2026-10-27", "2026-11-03", "2026-11-10"] }),
    ],
    true,
  );
  const byId = Object.fromEntries(followUps(desk, "2026-11-10").map((item) => [item.entry.id, item.actions]));
  assert.deepEqual(byId["1"] ?? [], []);
  assert.deepEqual(byId["2"] ?? [], []);
});

test("organiser-only page and download", () => {
  assert.match(read("src/app/admin/followup/page.tsx"), /isAdminSession/);
  assert.match(read("src/app/api/admin/export/route.ts"), /what === "followup"/);
});
