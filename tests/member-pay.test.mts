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

// Spec change, second round of 2026-11-02 (James): the membership is in the
// nav and open to search, no longer unlisted.
test("/join is in the nav, right after Tuesday", async () => {
  const { NAV_LINKS } = await import("../src/lib/nav.ts");
  const hrefs = NAV_LINKS.map((link) => link.href as string);
  assert.equal(hrefs[hrefs.indexOf("/tuesday") + 1], "/join");
  const page = readFileSync(path.join(root, "src/app/join/page.tsx"), "utf8");
  // Indexed, except a page opened on someone's own order reference.
  assert.match(page, /\.\.\.\(ref \? \{ robots: \{ index: false \} \} : \{\}\)/);
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
      // The pool is shared with the renewal test below, which closes it.
    }
  },
);

/* ── A yearly subscription (James 2026-11-02): renews by itself ─────────── */

test("★ the membership Checkout is a yearly subscription at A$658.90, tagged with its reference", async () => {
  const { createCheckout } = await import("../src/lib/stripe-pay.ts");
  const sent: string[] = [];
  const realFetch = globalThis.fetch;
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    sent.push(String(init?.body ?? ""));
    return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout", status: "open", payment_status: "unpaid", metadata: {} }), { status: 200 });
  }) as typeof fetch;
  try {
    await createCheckout({
      kind: "member", ref: "CMABCDE", signupId: "", session: MEMBERSHIP.id, amount: MEMBERSHIP.amount,
      title: "x", successUrl: "https://s", cancelUrl: "https://c", idempotencyKey: "k", recurring: "year",
    });
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.STRIPE_SECRET_KEY;
  }
  const form = new URLSearchParams(sent[0]);
  assert.equal(form.get("mode"), "subscription");
  assert.equal(form.get("line_items[0][price_data][recurring][interval]"), "year");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "65890");
  assert.equal(form.get("client_reference_id"), "CMABCDE");
  assert.equal(form.get("metadata[kind]"), "member");
  assert.equal(form.get("subscription_data[metadata][ref]"), "CMABCDE");
  // Stripe refuses payment_intent_data on a subscription Checkout.
  assert.equal([...form.keys()].some((key) => key.startsWith("payment_intent_data")), false);
});

test("the webhook renews on invoice.paid, matched by subscription", () => {
  const webhook = readFileSync(path.join(root, "src/app/api/stripe/webhook/route.ts"), "utf8");
  assert.match(webhook, /invoice\.paid/);
  assert.match(webhook, /renewMembership/);
  assert.match(webhook, /subscription_cycle/, "only renewals, not the first invoice");
});

test(
  "★ a renewal moves the year on to the period paid for, never back; an unknown subscription changes nothing",
  { skip: db ? false : "set COURSE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    process.env.DATABASE_URL = db;
    const { createCourseOrder, getPool, markPaidByCard, renewMembership } = await import("../src/lib/db.ts");
    const pool = getPool();
    const stamp = Date.now();
    const refs: string[] = [];
    try {
      const order = await createCourseOrder({
        course: MEMBERSHIP.id, cap: MEMBERSHIP.cap, signupId: null, name: "Rex", wechat: `rex-${stamp}`,
        industry: null, bizFocus: [], note: null, ref: newMemberRef(),
      });
      refs.push(order.ref);
      await markPaidByCard("member", order.ref, `sub_${stamp}`);
      // Pretend the year is nearly over.
      await pool.query(`UPDATE course_orders SET paid_at = now() - interval '364 days' WHERE ref = $1`, [order.ref]);
      const periodStart = new Date();
      assert.equal(await renewMembership(`sub_${stamp}`, periodStart), order.ref);
      const paidAt = async () => (await pool.query<{ t: Date }>(`SELECT paid_at AS t FROM course_orders WHERE ref = $1`, [order.ref])).rows[0].t.getTime();
      assert.equal(await paidAt(), periodStart.getTime(), "the year now runs from the renewed period");
      // A replayed old invoice cannot move it back, nor forward past the period paid for.
      await renewMembership(`sub_${stamp}`, new Date(periodStart.getTime() - 365 * 864e5));
      assert.equal(await paidAt(), periodStart.getTime());
      assert.equal(await renewMembership("sub_not_ours", periodStart), null);
      // A cancelled order is not revived by a renewal.
      await pool.query(`UPDATE course_orders SET status = 'cancelled' WHERE ref = $1`, [order.ref]);
      assert.equal(await renewMembership(`sub_${stamp}`, new Date()), null);
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE ref = ANY($1::text[])`, [refs]).catch(() => {});
      await pool.end();
    }
  },
);
