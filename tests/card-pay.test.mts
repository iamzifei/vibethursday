/**
 * Card payment for Tuesdays and dinners (2026-10-19, src/lib/stripe-pay.ts):
 * a new unpaid place is held for a while, becomes theirs once Stripe says it
 * was paid, and goes back on offer if not. Bank-transfer bookings made before
 * card payment started have no hold and are never released.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { CHECKOUT_HOLD_MINUTES, CHECKOUT_MINUTES, checkoutSettled, HOLD_MINUTES, kindOfRef, minutesLeft, stripeEnabled, toCents, verifyStripeSignature } from "../src/lib/stripe-pay.ts";
import { dinnerConfig } from "../src/lib/dinner.ts";

const SECRET = "whsec_test";
const sign = (body: string, t: number, secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

test("a webhook is accepted only with a fresh signature made with our secret", () => {
  const body = '{"type":"checkout.session.completed"}';
  const now = 1_800_000_000;
  assert.equal(verifyStripeSignature(body, sign(body, now), SECRET, now), true);
  assert.equal(verifyStripeSignature(body, `${sign(body, now, "other")},v1=00`, SECRET, now), false, "wrong secret");
  assert.equal(verifyStripeSignature(`${body} `, sign(body, now), SECRET, now), false, "body changed");
  assert.equal(verifyStripeSignature(body, sign(body, now - 301), SECRET, now), false, "too old");
  assert.equal(verifyStripeSignature(body, null, SECRET, now), false);
  assert.equal(verifyStripeSignature(body, sign(body, now), "", now), false, "no secret configured");
  // While a secret is being rolled Stripe sends two v1 values; either may match.
  assert.equal(verifyStripeSignature(body, `${sign(body, now)},v1=deadbeef`, SECRET, now), true);
});

test("references, amounts and holds", () => {
  assert.equal(kindOfRef("TUABCDE"), "tuesday");
  assert.equal(kindOfRef("DNABCDE"), "dinner");
  assert.equal(kindOfRef("AIABCDE"), null, "the class is not paid by card");
  assert.equal(toCents(33), 3300);
  assert.equal(toCents(32.99), 3299);
  assert.equal(minutesLeft(null), null);
  assert.equal(minutesLeft(new Date(10 * 60_000), new Date(0)), 10);
  assert.equal(minutesLeft(new Date(0), new Date(60_000)), 0, "never negative");
  assert.ok(CHECKOUT_HOLD_MINUTES > CHECKOUT_MINUTES, "a Checkout page can never outlive its hold");
  assert.equal(HOLD_MINUTES, 30);
  assert.equal(stripeEnabled({}), false, "off without a key: pages fall back to bank transfer");
  assert.equal(stripeEnabled({ STRIPE_SECRET_KEY: "sk_test_x" }), true);
});

test("a Checkout page settles when paid, or when a 100% code brought it to zero", () => {
  assert.equal(checkoutSettled("paid"), true);
  assert.equal(checkoutSettled("no_payment_required"), true);
  assert.equal(checkoutSettled("unpaid"), false);
  assert.equal(checkoutSettled(undefined), false);
});

test("the dinner menu carries descriptions, never prices", () => {
  const c = dinnerConfig(JSON.stringify({
    place: "x", time: "12:00", price: 40,
    dishes: [{ id: "kofta", zh: "烤羊肉丸", en: "Lamb Kofta", desc: "配塔布勒沙拉", price: 20 }],
  }));
  assert.equal(c?.dishes[0].desc, "配塔布勒沙拉");
  assert.equal("price" in (c?.dishes[0] ?? {}), false, "a restaurant price in the config is dropped");
});

/*
 * Against a throwaway local Postgres:
 *   CARD_TEST_DATABASE_URL=postgres://localhost:55433/vt_card_test npm test
 */
const db = process.env.CARD_TEST_DATABASE_URL;

test(
  "★ holds: an unpaid place lapses and is released, a paid one is locked in, a bank-transfer booking is never touched",
  { skip: db ? false : "set CARD_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const m = await import("../src/lib/db.ts");
    await m.ensureSchema();
    const pool = m.getPool();
    const tuesday = "2026-10-27";
    const thursday = "2026-10-29";
    const made: string[] = [];
    const person = async (n: number, session: string) => {
      const id = (await pool.query<{ id: string }>(
        `INSERT INTO signups (name, wechat, sessions) VALUES ($1, $2, ARRAY[$3]::date[]) RETURNING id::text AS id`,
        [`card${n}`, `card-${Date.now()}-${n}`, session],
      )).rows[0].id;
      made.push(id);
      return id;
    };
    const booked = async (id: string, session: string) =>
      (await pool.query<{ b: boolean }>(`SELECT $2::date = ANY(sessions) AS b FROM signups WHERE id = $1::bigint`, [id, session])).rows[0].b;
    const expire = (table: string, ref: string) => pool.query(`UPDATE ${table} SET hold_until = now() - interval '1 minute' WHERE ref = $1`, [ref]);

    try {
      // Tuesday: card-era signup with a hold, and a bank-transfer one without.
      const held = await person(1, tuesday);
      const legacy = await person(2, tuesday);
      const heldFee = await m.getOrCreateSessionFee(tuesday, held, "TUHHHH2", HOLD_MINUTES);
      const legacyFee = await m.getOrCreateSessionFee(tuesday, legacy, "TULLLL2");
      await expire("session_fees", heldFee.ref);
      await pool.query(`UPDATE session_fees SET created_at = now() - interval '5 days' WHERE ref = $1`, [legacyFee.ref]);
      await m.releaseExpiredHolds();
      assert.equal(await booked(held, tuesday), false, "the lapsed hold gives the place back");
      assert.equal(await booked(legacy, tuesday), true, "no hold, never released");
      const page = await m.getSessionFeeByRef(heldFee.ref);
      assert.equal(page?.booked, false);
      assert.equal(page?.status, "pending", "the row stays so the payment page can explain");

      // Signing up again restarts the hold; a legacy row never gains one.
      await pool.query(`UPDATE signups SET sessions = array_append(sessions, $2::date) WHERE id = $1::bigint`, [held, tuesday]);
      await m.getOrCreateSessionFee(tuesday, held, "TUNEW22", HOLD_MINUTES);
      await m.getOrCreateSessionFee(tuesday, legacy, "TUNEW23", HOLD_MINUTES);
      assert.ok((await m.getSessionFeeByRef(heldFee.ref))!.hold_until!.getTime() > Date.now(), "fresh hold");
      assert.equal((await m.getSessionFeeByRef(legacyFee.ref))!.hold_until, null, "still no deadline");

      // Paid by card after the hold lapsed: the money arrived, so the place is theirs again.
      await expire("session_fees", heldFee.ref);
      await m.releaseExpiredHolds();
      assert.equal(await m.markPaidByCard("tuesday", heldFee.ref), true);
      assert.equal(await booked(held, tuesday), true);
      assert.equal((await m.getSessionFeeByRef(heldFee.ref))?.status, "paid");
      assert.equal(await m.markPaidByCard("tuesday", heldFee.ref), false, "settling twice is a no-op");
      await m.releaseExpiredHolds();
      assert.equal(await booked(held, tuesday), true, "a paid place is never released");

      // Moving onto a paid Tuesday keeps that week's Thursday until the Tuesday
      // is paid: a lapsed hold leaves them on the Thursday, a payment gives it up.
      const mover = await person(6, tuesday);
      await pool.query(`UPDATE signups SET sessions = ARRAY[$2::date, $3::date] WHERE id = $1::bigint`, [mover, tuesday, thursday]);
      const moveFee = await m.getOrCreateSessionFee(tuesday, mover, "TURRRR2", HOLD_MINUTES, [thursday]);
      await expire("session_fees", moveFee.ref);
      await m.releaseExpiredHolds();
      assert.equal(await booked(mover, tuesday), false, "unpaid Tuesday released");
      assert.equal(await booked(mover, thursday), true, "and the Thursday was never given up");
      await m.markPaidByCard("tuesday", moveFee.ref);
      assert.equal(await booked(mover, tuesday), true, "paid: the Tuesday is theirs");
      assert.equal(await booked(mover, thursday), false, "and the Thursday it replaces is given up");

      // Settled by hand: the same.
      const byHand = await person(7, tuesday);
      await pool.query(`UPDATE signups SET sessions = ARRAY[$2::date, $3::date] WHERE id = $1::bigint`, [byHand, tuesday, thursday]);
      const handFee = await m.getOrCreateSessionFee(tuesday, byHand, "TUHAND2", HOLD_MINUTES, [thursday]);
      await m.setSessionFeeStatus(handFee.id, "paid");
      assert.equal(await booked(byHand, thursday), false);
      assert.equal((await m.getSessionFeeByRef(handFee.ref))?.hold_until, null, "no hold left to lapse");

      // Dinner: a lapsed seat is cancelled and frees the cap for the next person.
      const a = await person(3, thursday);
      const b = await person(4, thursday);
      const seat = await m.bookDinner({ session: thursday, signupId: a, dish: "x", ref: "DNAAAA2", cap: 1, holdMinutes: HOLD_MINUTES });
      assert.equal(seat.status, "pending");
      assert.equal((await m.bookDinner({ session: thursday, signupId: b, dish: "x", ref: "DNBBBB2", cap: 1, holdMinutes: HOLD_MINUTES })).status, "waitlist");
      await expire("dinner_orders", seat.ref);
      await pool.query(`DELETE FROM dinner_orders WHERE ref = 'DNBBBB2'`);
      assert.equal((await m.bookDinner({ session: thursday, signupId: b, dish: "x", ref: "DNBBBB2", cap: 1, holdMinutes: HOLD_MINUTES })).status, "pending", "the lapsed seat went back on offer");
      assert.equal((await m.getDinnerByRef(seat.ref))?.status, "cancelled");

      // /my reads one person's seat for one Thursday.
      assert.equal((await m.getDinnerFor(thursday, b))?.ref, "DNBBBB2");
      assert.equal(await m.getDinnerFor(thursday, held), null);

      // A page opened after the place was given away is refused.
      assert.equal(await m.attachCheckout("dinner", seat.ref, "cs_late", CHECKOUT_HOLD_MINUTES), false);

      // Someone who became a member after signing up is never released.
      const member = await person(5, tuesday);
      const memberFee = await m.getOrCreateSessionFee(tuesday, member, "TUMMMM2", HOLD_MINUTES);
      await pool.query(
        `INSERT INTO course_orders (course, signup_id, name, wechat, ref, status, paid_at)
         SELECT 'test', id, name, wechat, 'AIMMMM2', 'paid', now() FROM signups WHERE id = $1::bigint`,
        [member],
      );
      await expire("session_fees", memberFee.ref);
      await m.releaseExpiredHolds();
      assert.equal(await booked(member, tuesday), true, "a member owes nothing, so keeps the place");

      // A Checkout page Stripe let expire releases its seat at once.
      await m.attachCheckout("dinner", "DNBBBB2", "cs_test_1", CHECKOUT_HOLD_MINUTES);
      await m.expireCheckout("dinner", "cs_test_1");
      assert.equal((await m.getDinnerByRef("DNBBBB2"))?.status, "cancelled");
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE ref = 'AIMMMM2'`).catch(() => {});
      await pool.query(`DELETE FROM signups WHERE id = ANY($1::bigint[])`, [made]).catch(() => {});
      await pool.end();
    }
  },
);
