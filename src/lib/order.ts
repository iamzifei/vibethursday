// Relative, not "@/": the tests load this through Node's type stripper, which
// cannot resolve the tsconfig path alias.
import { createHmac, timingSafeEqual } from "node:crypto";
import { formatPrice, type Menu, type MenuItem } from "./menu.ts";

/**
 * Pre-ordering a drink for a session.
 *
 * Why this exists: the café asked for the orders as one sheet with a name on
 * every line, so it can take payment from each person by name when the doors
 * open and then make the coffee — instead of a room of people queuing at the
 * counter, and cups that end up with the wrong person because nothing on them
 * says whose they are.
 *
 * Everything in here is a pure rule with no database and no clock, the same
 * split as `checkin.ts` and `feedback.ts`: the routes and pages hand it dates,
 * rows and the menu, and it answers whether a link works, what an order costs,
 * and what the sheet for the bar says.
 */

export type Size = "small" | "large";

/** Same length and reasoning as the check-in and feedback codes. */
const CODE_LENGTH = 10;

/**
 * MEMBER_SECRET if set, otherwise ADMIN_TOKEN.
 *
 * ⚠️ A third copy of the same three lines in `checkin.ts` and `feedback.ts`,
 * deliberately, for the reason given in `feedback.ts`: check-in must not grow
 * new dependencies. The codes are kept apart by the label inside the HMAC, and
 * `tests/order.test.mts` asserts all three read the same environment.
 */
function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;

  if (!key) {
    throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; ordering is disabled");
  }

  return key;
}

/** True for a well-formed calendar date such as 2026-10-01, and nothing else. */
export function isSessionDate(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

function sign(input: string, key: string): string {
  return createHmac("sha256", key).update(input).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * The code that opens one session's order page.
 *
 * ★ `vt.order.v1:` keeps this from ever verifying as the check-in code for the
 * same Thursday. That matters more here than for feedback: this link is posted
 * in the group days ahead, and if it doubled as a check-in code anybody could
 * mark themselves present from home.
 */
export function orderCode(session: string, key: string = secret()): string {
  return sign(`vt.order.v1:${session}`, key).slice(0, CODE_LENGTH);
}

/** Constant-time check of a code presented for a session. */
export function verifyOrderCode(session: string, code: string | undefined | null, key: string = secret()): boolean {
  if (!code || !isSessionDate(session)) return false;
  return same(code, orderCode(session, key));
}

const DAY = 24 * 60 * 60 * 1000;

/** How many days before a session its order page opens. */
export const OPENS_DAYS_BEFORE = 7;

/**
 * Whether `session` takes orders when the Sydney date is `today`: from a week
 * before until the end of the day itself.
 *
 * By date, not by the clock. There is no "orders close at nine" rule: the
 * organiser can read the sheet at any moment and hand it over, and somebody
 * ordering from the train at 10:20 is still better off on the sheet than not.
 * The day after, the page closes so an old link cannot file an order under a
 * morning that has already happened.
 */
export function canOrder(session: string, today: string): boolean {
  if (!isSessionDate(session) || !isSessionDate(today)) return false;

  const daysAhead = Math.round((Date.parse(`${session}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  return daysAhead >= 0 && daysAhead <= OPENS_DAYS_BEFORE;
}

/** Whether an item has a small and a large. */
export function isSized(item: MenuItem): boolean {
  return typeof item.price !== "number";
}

export type Priced = {
  itemId: string;
  /** What goes on the sheet: "Flat White (L)", "Earl Grey Tea". */
  label: string;
  size: Size | null;
  cents: number;
};

/**
 * What an order is and what it costs, or null if the form does not describe a
 * real drink.
 *
 * ⚠️ Every field is whitelisted against the menu. The form is a POST body and
 * the price must come from here, never from anything the browser sent.
 *
 * A sized item needs a size; an unsized item ignores whatever size arrived
 * (the size radios are shared by the whole form, so a tea order still carries
 * the default size and that must not be an error).
 */
export function priceOrder(menu: Menu, itemId: string | null, size: string | null): Priced | null {
  const item = menu.items.find((entry) => entry.id === itemId);
  if (!item) return null;

  if (typeof item.price === "number") {
    return { itemId: item.id, label: item.name, size: null, cents: item.price };
  }

  if (size !== "small" && size !== "large") return null;

  return {
    itemId: item.id,
    label: `${item.name} (${size === "small" ? "S" : "L"})`,
    size,
    cents: item.price[size],
  };
}

/**
 * A name as the bar and the "find my order" box compare it.
 *
 * NFKC folds full-width letters and the ideographic space a Chinese keyboard
 * produces into their plain forms; then runs of whitespace collapse and case
 * is ignored. "Amy ", "ａｍｙ" and "AMY" are the same person at the counter.
 */
export function normaliseName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** One order, as the sheet and the lookup need it. */
export type OrderRow = {
  id: string;
  name: string;
  wechat: string | null;
  label: string;
  cents: number;
  note: string | null;
};

/**
 * Orders whose name matches `query`, for somebody standing at the counter who
 * has forgotten what they ordered and is on a different phone.
 *
 * Exact match after normalising, not "contains": typing "a" must not list
 * everybody whose name has an a in it. An empty query matches nothing.
 */
export function findByName<T extends { name: string }>(rows: readonly T[], query: string | null | undefined): T[] {
  const wanted = normaliseName(query ?? "");
  if (!wanted) return [];
  return rows.filter((row) => normaliseName(row.name) === wanted);
}

/**
 * A signed order id, for the "my order" cookie and the `mine=` link.
 *
 * Signed so that an id cannot be guessed into somebody else's order: ids are
 * sequential, and without this `mine=41` would show whoever ordered forty-first.
 * The label keeps it apart from every other HMAC on the site.
 */
export function orderToken(id: string, key: string = secret()): string {
  return `${id}.${sign(`vt.order.mine.v1:${id}`, key).slice(0, 16)}`;
}

/** The id inside a valid token, or null. */
export function readOrderToken(token: string | undefined | null, key: string = secret()): string | null {
  if (!token) return null;

  const [id, mac] = token.split(".");
  if (!id || !mac || !/^\d+$/.test(id)) return null;

  return same(token, orderToken(id, key)) ? id : null;
}

/** The cookie that remembers this phone's order for one session. */
export function orderCookieName(session: string): string {
  return `vt_order_${session.replaceAll("-", "")}`;
}

export type BarSheet = {
  /** "Flat White (L) × 3 — Amy, Bob, Chris", most-ordered first. */
  byDrink: string[];
  /** "Amy — Flat White (L) — $5.50 — oat milk", alphabetical, for taking payment by name. */
  byName: string[];
  cups: number;
  cents: number;
};

/**
 * The sheet for the bar, in two orders.
 *
 * By drink is what the barista makes from. By name is what the person taking
 * payment reads from — and what they read out to somebody who has forgotten
 * what they ordered. English throughout: it is handed to the café.
 */
export function barSheet(rows: readonly OrderRow[]): BarSheet {
  const groups = new Map<string, string[]>();

  for (const row of rows) {
    const names = groups.get(row.label) ?? [];
    names.push(row.note ? `${row.name} (${row.note})` : row.name);
    groups.set(row.label, names);
  }

  const byDrink = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([label, names]) => `${label} × ${names.length} — ${names.join(", ")}`);

  const byName = [...rows]
    .sort((a, b) => normaliseName(a.name).localeCompare(normaliseName(b.name)))
    .map((row) => [row.name, row.label, formatPrice(row.cents), row.note].filter(Boolean).join(" — "));

  return {
    byDrink,
    byName,
    cups: rows.length,
    cents: rows.reduce((sum, row) => sum + row.cents, 0),
  };
}
