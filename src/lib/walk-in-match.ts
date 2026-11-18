/**
 * Pairs people who checked in by typing their name at the door ("walk-ins")
 * with an earlier signup that is probably the same person.
 *
 * Why: on 1 October many people could not find their own name on the check-in
 * list — they had signed up under a nickname, or could not tell a WeChat ID
 * from a WeChat name — so the check-in page now puts "type your name" at the
 * top (James 2026-10-01). Each of those creates a new signup row; without
 * folding it into the old one, next week that person counts as new.
 *
 * Only a suggestion. Two people really can share a name, so the organiser
 * presses merge (`mergeSignups`); nothing here writes. Pure, so it can be
 * tested without a database.
 */

export type MatchableSignup = { id: string; name: string; source: string | null; created_at: string };

export type WalkInMatch = {
  walkIn: { id: string; name: string };
  /** Earlier, non-walk-in signups whose name matches, oldest first. */
  candidates: { id: string; name: string }[];
};

/** How long a walk-in keeps being suggested. Past this, an unmerged pair is taken to be two people. */
const LOOKBACK_DAYS = 14;

/** Lower-case with every kind of space removed. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[\s　]+/g, "");
}

/**
 * Same name, or one contained in the other. Containment needs enough to go on:
 * two Chinese characters ("小河" in "小河姐姐"), but three letters for a Latin
 * name — "Al" or "Jo" is inside half the list.
 */
function sameName(a: string, b: string): boolean {
  const x = squash(a);
  const y = squash(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const shorter = x.length <= y.length ? x : y;
  const minimum = /^[a-z0-9]+$/.test(shorter) ? 3 : 2;
  return shorter.length >= minimum && (x.includes(y) || y.includes(x));
}

export function walkInMatches(rows: readonly MatchableSignup[], now: Date): WalkInMatch[] {
  const since = now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const earlier = rows
    .filter((row) => row.source !== "walk-in")
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  const out: WalkInMatch[] = [];
  for (const walkIn of rows) {
    if (walkIn.source !== "walk-in" || Date.parse(walkIn.created_at) < since) continue;
    const candidates = earlier
      .filter((row) => Date.parse(row.created_at) < Date.parse(walkIn.created_at) && sameName(row.name, walkIn.name))
      .map((row) => ({ id: row.id, name: row.name }));
    if (candidates.length > 0) out.push({ walkIn: { id: walkIn.id, name: walkIn.name }, candidates });
  }
  return out;
}

/** A signup row with what `botSignupMatches` also reads. `SignupRow` has it all. */
export type BotMatchableSignup = MatchableSignup & { email: string | null; wechat: string | null; wechat_name: string | null };

export type BotSignupMatch = {
  bot: { id: string; name: string; wechatName: string };
  /** Signups with an email or WeChat ID whose name matches, oldest first. */
  candidates: { id: string; name: string }[];
};

/**
 * Pairs a sign-up the WeChat group bot made from a display name alone
 * (2026-11-18, bot-signup.ts) with a normal signup that is probably the same
 * person — typically they later signed up on the site with their WeChat ID.
 *
 * Like `walkInMatches`, a suggestion only, and the organiser presses merge
 * (keeping the normal row). Either order counts: the bot row can come first
 * or second. Shown while either row is under `LOOKBACK_DAYS` old.
 */
export function botSignupMatches(rows: readonly BotMatchableSignup[], now: Date, botSource: string): BotSignupMatch[] {
  const since = now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const recent = (row: MatchableSignup) => Date.parse(row.created_at) >= since;
  const withContact = rows
    .filter((row) => row.email || row.wechat)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  const out: BotSignupMatch[] = [];
  for (const bot of rows) {
    if (bot.source !== botSource || bot.email || bot.wechat || !bot.wechat_name) continue;
    const wechatName = bot.wechat_name;
    const candidates = withContact
      .filter((row) => row.id !== bot.id && (recent(row) || recent(bot)))
      .filter((row) => sameName(row.name, bot.name) || sameName(row.name, wechatName) || (row.wechat_name !== null && sameName(row.wechat_name, wechatName)))
      .map((row) => ({ id: row.id, name: row.name }));
    if (candidates.length > 0) out.push({ bot: { id: bot.id, name: bot.name, wechatName }, candidates });
  }
  return out;
}
