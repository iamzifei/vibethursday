/**
 * The 12/13 AI+IP class as a refresher (James 2026-11-18).
 *
 * Anyone who has already taken a class (a paid order for the 10/25 or the
 * 11/15 class) takes the 12/13 one as a refresher and pays only the A$40 seat
 * fee — member or not. A yearly 共创会员 who has never taken a class takes it
 * free.
 *
 * Against a throwaway local Postgres:
 *   COURSE_TEST_DATABASE_URL=postgres://localhost:55432/vt_course_test pnpm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { COURSE, IP_COURSE, IP_COURSE_1115, newCourseRef, PAST_CLASS_IDS, REFRESHER } from "../src/lib/course.ts";

test("earlier classes count as taken; the class on sale does not", () => {
  assert.deepEqual([...PAST_CLASS_IDS], [COURSE.id, IP_COURSE_1115.id]);
  assert.ok(!(PAST_CLASS_IDS as readonly string[]).includes(IP_COURSE.id));
  assert.equal(IP_COURSE_1115.id, "2026-11-15-ai-ip", "old orders keep the id they were saved under");
  // Spec change 2026-11-25 (James): the refresher fee is 10% of the class
  // fee plus GST, stated as a rule on the page with no dollar figure.
  assert.match(REFRESHER.payLabel, /课程学费 ×10% \+ GST/);
  assert.doesNotMatch(REFRESHER.payLabel, /\d+ 澳元/);
});

const db = process.env.COURSE_TEST_DATABASE_URL;

test(
  "★ a past student's 12/13 order is a refresher; a newcomer's is not",
  { skip: db ? false : "set COURSE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { createCourseOrder, ensureSchema, getCourseOrderByRef, getPool, hasTakenClass, listCourseOrders } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const stamp = `rf${Date.now()}`;
    const refs: string[] = [];
    const made: string[] = [];
    const order = async (course: string, name: string, wechat: string, status: string) => {
      const ref = newCourseRef();
      refs.push(ref);
      await pool.query(
        `INSERT INTO course_orders (course, name, wechat, ref, status, paid_at) VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = 'paid' THEN now() END)`,
        [course, name, wechat, ref, status],
      );
    };
    const signUp = async (name: string, wechat: string) => {
      const made = await createCourseOrder({
        course: IP_COURSE.id, cap: IP_COURSE.cap, signupId: null, name, wechat,
        industry: null, bizFocus: [], note: null, ref: newCourseRef(),
      });
      refs.push(made.ref);
      return made.ref;
    };

    try {
      await order(IP_COURSE_1115.id, "Ivy", `ivy-${stamp}`, "paid");
      await order(COURSE.id, "Max", `max-${stamp}`, "paid");
      await order(IP_COURSE_1115.id, "Pat", `pat-${stamp}`, "pending");

      // WeChat IDs match the way every membership check matches them.
      assert.equal(await hasTakenClass(null, ` IVY-${stamp.toUpperCase()} `), true, "the 11/15 class counts");
      assert.equal(await hasTakenClass(null, `max-${stamp}`), true, "the 10/25 class counts");
      assert.equal(await hasTakenClass(null, `pat-${stamp}`), false, "an unpaid order does not");
      assert.equal(await hasTakenClass(null, `new-${stamp}`), false);

      const ivy = await getCourseOrderByRef(await signUp("Ivy", `ivy-${stamp}`));
      const pat = await getCourseOrderByRef(await signUp("Pat", `pat-${stamp}`));
      assert.equal(ivy?.refresher, true, "/class shows Ivy the refresher fee");
      assert.equal(pat?.refresher, false, "Pat never finished paying, so pays in full");

      const listed = await listCourseOrders(IP_COURSE.id);
      assert.equal(listed.find((o) => o.wechat === `ivy-${stamp}`)?.refresher, true, "/admin flags it too");

      // Matched by signup too: a member recognised by login who took the
      // 11/15 class under a different WeChat ID is still a refresher, so the
      // route must not confirm their 12/13 order free.
      const sam = (
        await pool.query<{ id: string }>(`INSERT INTO signups (name, wechat, sessions) VALUES ('Sam', $1, ARRAY['2026-11-03']::date[]) RETURNING id::text AS id`, [`sam-${stamp}`])
      ).rows[0].id;
      made.push(sam);
      const ref = newCourseRef();
      refs.push(ref);
      await pool.query(
        `INSERT INTO course_orders (course, signup_id, name, wechat, ref, status, paid_at) VALUES ($1, $2::bigint, 'Sam', $3, $4, 'paid', now())`,
        [IP_COURSE_1115.id, sam, `old-sam-${stamp}`, ref],
      );
      assert.equal(await hasTakenClass(sam, `sam-${stamp}`), true, "matched by signup id");
      assert.equal(await hasTakenClass(null, `sam-${stamp}`), false, "the WeChat ID alone does not match");
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE ref = ANY($1::text[])`, [refs]).catch(() => {});
      await pool.query(`DELETE FROM signups WHERE id = ANY($1::bigint[])`, [made]).catch(() => {});
      await pool.end();
    }
  },
);
