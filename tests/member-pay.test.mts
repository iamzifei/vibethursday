/**
 * Buying the 共创会员 by card (2026-11-02).
 *
 * Sold at Build Tuesday and by a link James sends, never from the nav: A$599 +
 * GST, paid on Stripe, settled the moment Stripe says so. Each order carries
 * its own reference (CM…), which travels to Stripe as the client reference,
 * in metadata and in the payment description, so a payment can always be
 * traced back to the person. What it gives: a year of free Tuesdays and one
 * AI+IP class — the same as the $599 sold before, so both count as members.
 *
 * Against a throwaway local Postgres:
 *   COURSE_TEST_DATABASE_URL=postgres://127.0.0.1:55433/vt_b npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { COURSE, MEMBERSHIP, MEMBERSHIP_COURSES, looksLikeMemberRef, newMemberRef } from "../src/lib/course.ts";
import { kindOfRef, toCents } from "../src/lib/stripe-pay.ts";

const root = path.resolve(import.meta.dirname, "..");

test("the membership costs A$599 + GST, charged as A$658.90", () => {
  assert.equal(MEMBERSHIP.price, 599);
  assert.equal(toCents(MEMBERSHIP.amount), 65890);
});

test("★ both the old $599 and the new membership make a member", () => {
  assert.ok((MEMBERSHIP_COURSES as readonly string[]).includes(COURSE.id));
  assert.ok((MEMBERSHIP_COURSES as readonly string[]).includes(MEMBERSHIP.id));
});

test("a membership reference is its own kind, distinct from Tuesday, dinner and the class", () => {
  const ref = newMemberRef();
  assert.ok(looksLikeMemberRef(ref), ref);
  assert.equal(kindOfRef(ref), "member");
  assert.equal(kindOfRef("AIABCDE"), null, "a bank-transfer class reference is never paid by card");
  assert.equal(kindOfRef("TUABCDE"), "tuesday");
});

test("the webhook settles membership payments; the code route does not take them", () => {
  const webhook = readFileSync(path.join(root, "src/app/api/stripe/webhook/route.ts"), "utf8");
  assert.match(webhook, /"member"/);
  const code = readFileSync(path.join(root, "src/app/api/pay/code/route.ts"), "utf8");
  assert.match(code, /kind === "member"/);
});

test("/join stays out of the nav and out of search", () => {
  const nav = readFileSync(path.join(root, "src/lib/nav.ts"), "utf8");
  assert.ok(!nav.includes("/join"));
  const page = readFileSync(path.join(root, "src/app/join/page.tsx"), "utf8");
  assert.match(page, /index: false/);
});

const db = process.env.COURSE_TEST_DATABASE_URL;

test(
  "★ a card payment makes the buyer a member; settling twice does nothing",
  { skip: db ? false : "set COURSE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { attachCheckout, createCourseOrder, ensureSchema, getCourseOrderByRef, getPool, isMember, markPaidByCard } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const stamp = Date.now();
    const wechat = `mia-${stamp}`;
    let signupId = "";
    const refs: string[] = [];
    try {
      signupId = (
        await pool.query<{ id: string }>(`INSERT INTO signups (name, wechat) VALUES ('Mia', $1) RETURNING id::text AS id`, [wechat])
      ).rows[0].id;
      const order = await createCourseOrder({
        course: MEMBERSHIP.id, cap: MEMBERSHIP.cap, signupId: null, name: "Mia", wechat,
        industry: null, bizFocus: [], note: null, ref: newMemberRef(),
      });
      refs.push(order.ref);
      assert.equal(order.status, "pending");
      assert.equal(await isMember(signupId), false, "not a member before paying");

      assert.equal(await attachCheckout("member", order.ref, "cs_test_123", 0), true);
      assert.equal((await getCourseOrderByRef(order.ref))?.stripe_session, "cs_test_123");

      assert.equal(await markPaidByCard("member", order.ref), true);
      assert.equal((await getCourseOrderByRef(order.ref))?.status, "paid");
      assert.equal(await isMember(signupId), true, "a member once paid (matched by WeChat ID)");
      assert.equal(await markPaidByCard("member", order.ref), false, "a second webhook changes nothing");
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE ref = ANY($1::text[])`, [refs]).catch(() => {});
      if (signupId) await pool.query(`DELETE FROM signups WHERE id = $1::bigint`, [signupId]).catch(() => {});
      await pool.end();
    }
  },
);
