/**
 * The running cost of putting the meetup on, and what has come in towards it.
 *
 * This exists so the ask on /support is never "support us" in the abstract.
 * People give when they can see the actual number and see that it is not a
 * profit — so the page states the venue bill, lists every session, and shows
 * the balance carried forward. That transparency is the whole mechanism.
 *
 * Amounts are held in **cents** so the arithmetic is exact. Formatting back to
 * dollars happens once, at the edge, in `formatAud`.
 *
 * Updating this after a session is a one-line edit plus a deploy. That is
 * deliberate: a database table would need an admin screen to be useful, and
 * this is three numbers a week.
 */

/**
 * There is deliberately no "the venue costs X" constant here.
 *
 * It changes: some places charge a minimum spend, some charge for the room,
 * and the number moves whenever the venue does. A constant would be copied
 * into the page copy, and page copy that states a fixed price starts lying the
 * first week the price is different. The ledger below carries the real figure
 * for each session; the copy stays qualitative and points at it.
 */

export type LedgerEntry = {
  /** Session date, `YYYY-MM-DD`. */
  date: string;
  /** Voluntary contributions from attendees, in cents. */
  received: number;
  /** Paid out to the venue (and anything else), in cents. */
  spent: number;
  /** How many people chipped in. Never who — see the note below. */
  contributors: number;
};

/**
 * One row per session, oldest first.
 *
 * `contributors` is a count and never a list of names. Publishing who gave
 * turns a voluntary thing into a visible one, and a visible one is a social
 * obligation — which is the exact failure this whole design avoids.
 *
 * 2026-08-06 (the first session) is absent on purpose: the venue was donated
 * that week, so there was no bill and nothing to split.
 */
export const LEDGER: LedgerEntry[] = [];

/**
 * The ways someone keeps this thing running.
 *
 * Money is one of four on purpose. A list of people who paid, shown to a room
 * of twenty who sit at one table, is legible in a way a GitHub sponsor wall
 * never is — everyone can see who is missing. Open source solved this long
 * before us: a contributor is anyone who put something in, and code was never
 * the only currency. Mixing the kinds means being on this list says "showed
 * up for this" and nothing about anybody's bank balance.
 */
export type ContributionKind = "money" | "demo" | "brought" | "helped";

export type Contributor = {
  name: string;
  /** Member card slug, when they have one — the name links to it. */
  slug?: string;
  kinds: ContributionKind[];
};

/**
 * Everyone listed here **asked to be listed**.
 *
 * That is the property the whole thing rests on. Opt-in means absence carries
 * no information: someone who chipped in and stayed off this list is
 * indistinguishable from someone who never chipped in, so the promise that
 * nobody can be spotted for not giving survives having a list at all.
 *
 * Order is the order people joined it. There is no ranking and amounts are
 * never recorded here — see LEDGER for the totals, which stay aggregate.
 */
export const CONTRIBUTORS: Contributor[] = [];

export type LedgerRow = LedgerEntry & {
  /** Balance after this session, in cents. Can be negative. */
  balance: number;
};

/**
 * Walks the ledger oldest-to-newest, carrying the balance forward.
 *
 * Returned newest-first, because the page is read by someone asking "where
 * does it stand now", not "how did it start".
 */
export function ledgerRows(entries: LedgerEntry[] = LEDGER): LedgerRow[] {
  let balance = 0;
  const rows = entries.map((entry) => {
    balance += entry.received - entry.spent;
    return { ...entry, balance };
  });

  return rows.reverse();
}

/** Balance across every session so far, in cents. Negative means out of pocket. */
export function ledgerBalance(entries: LedgerEntry[] = LEDGER): number {
  return entries.reduce((total, entry) => total + entry.received - entry.spent, 0);
}

/** `11800` → `"$118"`, `12350` → `"$123.50"`. Whole dollars lose the `.00`. */
export function formatAud(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;

  return remainder === 0
    ? `${sign}$${dollars.toLocaleString("en-AU")}`
    : `${sign}$${dollars.toLocaleString("en-AU")}.${String(remainder).padStart(2, "0")}`;
}

/**
 * Where contributions go.
 *
 * A constant rather than an environment variable, unlike the PayID this
 * replaced. A PayID is a personal phone number or email and had to stay out of
 * the repository; a Ko-fi page is a public address whose entire purpose is to
 * be shared. Making it configuration bought nothing and cost a deploy-time
 * footgun: ship without the variable set and the page quietly renders with no
 * way to give, which looks identical to working.
 *
 * The Ko-fi widget script is deliberately not used. It pulls in a third-party
 * script on a page about money, paints a blue button into a lime-on-black
 * palette, and labels itself "Support me" — singular, which is the opposite of
 * what this page says. A link needs none of that.
 */
export const SUPPORT_URL = "https://ko-fi.com/vibethursday";
