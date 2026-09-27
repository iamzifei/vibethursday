import assert from "node:assert/strict";
import { test } from "node:test";
import { checkinCode, verifyCheckinCode } from "../src/lib/checkin.ts";
import { feedbackCode, verifyFeedbackCode } from "../src/lib/feedback.ts";
import { formatPrice, priceRange, VENUE_MENU } from "../src/lib/menu.ts";
import {
  barSheet,
  canOrder,
  findByName,
  normaliseName,
  OPENS_DAYS_BEFORE,
  orderCode,
  orderCookieName,
  orderToken,
  priceOrder,
  readOrderToken,
  verifyOrderCode,
  type OrderRow,
} from "../src/lib/order.ts";

/**
 * Drink pre-orders (`src/lib/order.ts`, `src/lib/menu.ts`).
 *
 * The failures worth a test here are the quiet ones: a code that opens another
 * door, a price that comes from the browser instead of the menu, a token that
 * shows somebody else's order, and a name lookup that lists half the room.
 */

const KEY = "test-key-not-a-real-secret";
const SESSION = "2026-10-01";
const day = 24 * 60 * 60 * 1000;

/** `n` days after `session` (negative for before), as an ISO date. */
function shift(session: string, n: number): string {
  return new Date(Date.parse(`${session}T00:00:00Z`) + n * day).toISOString().slice(0, 10);
}

test("a code verifies for its own session and nothing else", () => {
  const code = orderCode(SESSION, KEY);

  assert.ok(verifyOrderCode(SESSION, code, KEY));
  assert.ok(!verifyOrderCode("2026-10-08", code, KEY));
  assert.ok(!verifyOrderCode(SESSION, `${code}x`, KEY));
  assert.ok(!verifyOrderCode(SESSION, "", KEY));
  assert.ok(!verifyOrderCode(SESSION, null, KEY));
  assert.ok(!verifyOrderCode(SESSION, code, "another-key"));
  assert.ok(!verifyOrderCode("2026-02-31", orderCode("2026-02-31", KEY), KEY));
});

test("★ the order link cannot check anybody in or leave feedback, and neither code opens it", () => {
  // The order link goes into the group days ahead. If it verified as a
  // check-in code, anybody could mark themselves present from home.
  const order = orderCode(SESSION, KEY);

  assert.notEqual(order, checkinCode(SESSION, KEY));
  assert.notEqual(order, feedbackCode(SESSION, KEY));
  assert.ok(!verifyCheckinCode(SESSION, order, KEY));
  assert.ok(!verifyFeedbackCode(SESSION, order, KEY));
  assert.ok(!verifyOrderCode(SESSION, checkinCode(SESSION, KEY), KEY));
  assert.ok(!verifyOrderCode(SESSION, feedbackCode(SESSION, KEY), KEY));
});

test("★ takes its key from the same environment as check-in and feedback", () => {
  const saved = { member: process.env.MEMBER_SECRET, admin: process.env.ADMIN_TOKEN };

  try {
    delete process.env.MEMBER_SECRET;
    process.env.ADMIN_TOKEN = "admin-only";
    assert.equal(orderCode(SESSION), orderCode(SESSION, "admin-only"));
    assert.equal(orderToken("7"), orderToken("7", "admin-only"));

    process.env.MEMBER_SECRET = "member-wins";
    assert.equal(orderCode(SESSION), orderCode(SESSION, "member-wins"));

    delete process.env.MEMBER_SECRET;
    delete process.env.ADMIN_TOKEN;
    assert.throws(() => orderCode(SESSION));
  } finally {
    if (saved.member === undefined) delete process.env.MEMBER_SECRET;
    else process.env.MEMBER_SECRET = saved.member;

    if (saved.admin === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = saved.admin;
  }
});

test("orders open a week ahead and close the day after", () => {
  assert.equal(OPENS_DAYS_BEFORE, 7);

  assert.ok(!canOrder(SESSION, shift(SESSION, -8)));
  assert.ok(canOrder(SESSION, shift(SESSION, -7)));
  assert.ok(canOrder(SESSION, shift(SESSION, -1)));
  // The morning itself: somebody ordering from the train is still on the sheet.
  assert.ok(canOrder(SESSION, SESSION));
  assert.ok(!canOrder(SESSION, shift(SESSION, 1)));

  assert.ok(!canOrder("not-a-date", SESSION));
  assert.ok(!canOrder(SESSION, "2026-13-01"));
});

test("★ the price comes from the menu, never from the form", () => {
  assert.deepEqual(priceOrder(VENUE_MENU, "flat-white", "large"), {
    itemId: "flat-white",
    label: "Flat White (L)",
    size: "large",
    cents: 550,
  });
  assert.equal(priceOrder(VENUE_MENU, "flat-white", "small")?.cents, 500);
  assert.equal(priceOrder(VENUE_MENU, "flat-white", "small")?.label, "Flat White (S)");

  // A sized drink with no size, or a made-up one, is not an order.
  assert.equal(priceOrder(VENUE_MENU, "flat-white", null), null);
  assert.equal(priceOrder(VENUE_MENU, "flat-white", "venti"), null);

  // An unsized drink ignores the size the shared radios always send.
  assert.deepEqual(priceOrder(VENUE_MENU, "earl-grey", "large"), {
    itemId: "earl-grey",
    label: "Earl Grey Tea",
    size: null,
    cents: 500,
  });

  assert.equal(priceOrder(VENUE_MENU, "free-coffee", "large"), null);
  assert.equal(priceOrder(VENUE_MENU, null, "large"), null);
});

test("the menu is well-formed: unique ids, known categories, positive whole-cent prices", () => {
  const ids = VENUE_MENU.items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);

  const categories = new Set(VENUE_MENU.categories.map((category) => category.id));
  for (const item of VENUE_MENU.items) {
    assert.ok(categories.has(item.category), `${item.id} has an unknown category`);

    const prices = typeof item.price === "number" ? [item.price] : [item.price.small, item.price.large];
    for (const price of prices) {
      assert.ok(Number.isInteger(price) && price > 0, `${item.id} has a bad price`);
    }
  }

  assert.equal(formatPrice(550), "$5.50");
  assert.equal(formatPrice(1200), "$12.00");
  assert.equal(priceRange({ small: 500, large: 550 }), "$5.00 / $5.50");
});

test("★ a token shows its own order and cannot be walked to someone else's", () => {
  const token = orderToken("41", KEY);

  assert.equal(readOrderToken(token, KEY), "41");

  // Ids are sequential; the signature is what stops `mine=42` from working.
  const [, mac] = token.split(".");
  assert.equal(readOrderToken(`42.${mac}`, KEY), null);
  assert.equal(readOrderToken("41", KEY), null);
  assert.equal(readOrderToken("41.", KEY), null);
  assert.equal(readOrderToken("abc.def", KEY), null);
  assert.equal(readOrderToken(token, "another-key"), null);
  assert.equal(readOrderToken(null, KEY), null);

  // One cookie per session, and a name a browser accepts.
  assert.equal(orderCookieName(SESSION), "vt_order_20261001");
});

test("finding your order by name is exact after normalising, and never lists the room", () => {
  const rows = [{ name: "Amy" }, { name: "Amy Chen" }, { name: "amy" }, { name: "Bob" }];

  assert.deepEqual(findByName(rows, "  AMY "), [{ name: "Amy" }, { name: "amy" }]);
  // Full-width letters and the ideographic space from a Chinese keyboard.
  assert.deepEqual(findByName(rows, "ａｍｙ　chen"), [{ name: "Amy Chen" }]);
  // Not "contains": one letter must not list everybody.
  assert.deepEqual(findByName(rows, "a"), []);
  assert.deepEqual(findByName(rows, ""), []);
  assert.deepEqual(findByName(rows, "   "), []);
  assert.deepEqual(findByName(rows, null), []);

  assert.equal(normaliseName(" Kevin   Wang "), "kevin wang");
});

test("the bar sheet groups by drink and lists by name, with the totals", () => {
  const rows: OrderRow[] = [
    { id: "1", name: "Bob", wechat: null, label: "Flat White (L)", cents: 550, note: null },
    { id: "2", name: "amy", wechat: null, label: "Flat White (L)", cents: 550, note: "oat milk" },
    { id: "3", name: "Chris", wechat: null, label: "Earl Grey Tea", cents: 500, note: null },
  ];

  const sheet = barSheet(rows);

  assert.deepEqual(sheet.byDrink, [
    "Flat White (L) × 2 — Bob, amy (oat milk)",
    "Earl Grey Tea × 1 — Chris",
  ]);
  assert.deepEqual(sheet.byName, [
    "amy — Flat White (L) — $5.50 — oat milk",
    "Bob — Flat White (L) — $5.50",
    "Chris — Earl Grey Tea — $5.00",
  ]);
  assert.equal(sheet.cups, 3);
  assert.equal(sheet.cents, 1600);

  assert.deepEqual(barSheet([]), { byDrink: [], byName: [], cups: 0, cents: 0 });
});
