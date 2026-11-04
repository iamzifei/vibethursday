/**
 * Who counts as a 共创会员 (2026-11-01).
 *
 * Until now any paid class order made someone a member for a year — fine while
 * there was only ever one class, the $599 membership. The second class (the
 * A$365 AI+IP class, `IP_COURSE`) is not a membership: its students pay for
 * Tuesdays like anyone else and carry no member badge (James 2026-11-01).
 * Members themselves take that class free, so their order is confirmed
 * without a transfer.
 *
 * Against a throwaway local Postgres:
 *   COURSE_TEST_DATABASE_URL=postgres://localhost:55432/vt_course_test pnpm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { COURSE, IP_COURSE, MEMBERSHIP, MEMBERSHIP_COURSES, newCourseRef } from "../src/lib/course.ts";

// Spec change 2026-11-02 (James): the 共创会员 is also sold on its own (/join),
// and that order counts too. The A$365 class still never does.
// Spec change 2026-11-05: Tuesday online / 4-week membership — the yearly
// membership keeps its id ("vt-cocreator") and the 4-week one is added.
test("only the $599 class and the membership on its own are memberships", () => {
  assert.deepEqual([...MEMBERSHIP_COURSES], [COURSE.id, "vt-cocreator", MEMBERSHIP.id]);
  assert.ok(!(MEMBERSHIP_COURSES as readonly string[]).includes(IP_COURSE.id));
});

const db = process.env.COURSE_TEST_DATABASE_URL;

test(
  "★ a paid AI+IP order is not a membership; a paid $599 order is; members take the AI+IP class free",
  { skip: db ? false : "set COURSE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { createCourseOrder, ensureSchema, getPool, isMember, listTuesdayFeeDesk } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const stamp = Date.now();
    const made: string[] = [];
    const refs: string[] = [];
    const signup = async (name: string, wechat: string) => {
      const id = (
        await pool.query<{ id: string }>(
          `INSERT INTO signups (name, wechat, sessions) VALUES ($1, $2, ARRAY['2026-11-03']::date[]) RETURNING id::text AS id`,
          [name, wechat],
        )
      ).rows[0].id;
      made.push(id);
      return id;
    };
    const paidOrder = async (course: string, name: string, wechat: string) => {
      const ref = newCourseRef();
      refs.push(ref);
      await pool.query(
        `INSERT INTO course_orders (course, name, wechat, ref, status, paid_at) VALUES ($1, $2, $3, $4, 'paid', now())`,
        [course, name, wechat, ref],
      );
    };

    try {
      const student = await signup("Ivy", `ivy-${stamp}`);
      await paidOrder(IP_COURSE.id, "Ivy", `ivy-${stamp}`);
      assert.equal(await isMember(student), false, "the AI+IP class does not make a member");

      const member = await signup("Max", `max-${stamp}`);
      await paidOrder(COURSE.id, "Max", `max-${stamp}`);
      assert.equal(await isMember(member), true, "the $599 class does");

      const desk = await listTuesdayFeeDesk("2026-11-03");
      assert.equal(desk.find((row) => row.signup_id === student)?.member, false, "the Tuesday desk agrees");
      assert.equal(desk.find((row) => row.signup_id === member)?.member, true);

      const free = await createCourseOrder({
        course: IP_COURSE.id, cap: IP_COURSE.cap, signupId: member, name: "Max", wechat: `max-${stamp}`,
        industry: null, bizFocus: [], note: null, ref: newCourseRef(), free: true,
      });
      refs.push(free.ref);
      assert.equal(free.status, "paid", "a member's AI+IP order needs no transfer");

      const guest = await createCourseOrder({
        course: IP_COURSE.id, cap: IP_COURSE.cap, signupId: null, name: "Gus", wechat: `gus-${stamp}`,
        industry: null, bizFocus: [], note: null, ref: newCourseRef(),
      });
      refs.push(guest.ref);
      assert.equal(guest.status, "pending", "everyone else transfers");
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE ref = ANY($1::text[])`, [refs]).catch(() => {});
      await pool.query(`DELETE FROM session_fees WHERE signup_id = ANY($1::bigint[])`, [made]).catch(() => {});
      await pool.query(`DELETE FROM signups WHERE id = ANY($1::bigint[])`, [made]).catch(() => {});
      await pool.end();
    }
  },
);
