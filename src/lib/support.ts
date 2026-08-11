/**
 * What `/support` needs: somewhere to send a contribution, and the opt-in list
 * of people keeping this thing running.
 *
 * There is **no public ledger**, by decision (2026-08-11). An earlier version
 * published a per-session table of money in, money out, and balance carried
 * forward. That is a real thing to give up — it was the only way "I am not
 * making money on this" could be checked rather than asserted — so nothing on
 * the page claims or implies otherwise. It says what a session costs, says the
 * organiser covers it, and stops there.
 *
 * There is also deliberately no "the venue costs X" constant. It changes: some
 * places charge a minimum spend, some charge for the room. Copy naming an exact
 * figure starts lying the first week the figure is different, and nobody
 * remembers to edit eight strings across two languages. The copy gives a range.
 */

/**
 * The ways someone keeps this thing running.
 *
 * Money is one of four on purpose. A list of people who paid, shown to a room
 * of twenty who sit at one table, is legible in a way a GitHub sponsor wall
 * never is — everyone can see who is missing. Open source solved this long
 * before us: a contributor is anyone who put something in, and code was never
 * the only currency. Mixing the kinds means being on this list says "showed up
 * for this" and nothing about anybody's bank balance.
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
 * Order is the order people joined it. There is no ranking, and no amount is
 * ever recorded against a name — not here, not anywhere.
 */
export const CONTRIBUTORS: Contributor[] = [];

/**
 * Where contributions go.
 *
 * A constant rather than an environment variable. A Ko-fi page is a public
 * address whose entire purpose is to be shared, so making it configuration
 * bought nothing and cost a deploy-time footgun: ship without the variable set
 * and the page quietly renders with no way to give, which looks identical to
 * working.
 *
 * The Ko-fi widget script is deliberately not used. It pulls a third-party
 * script onto a page about money, paints a blue button into a lime-on-black
 * palette, and labels itself "Support me" — singular, which is the opposite of
 * what this page says. A link needs none of that.
 */
export const SUPPORT_URL = "https://ko-fi.com/vibethursday";
