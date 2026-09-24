// Relative, not "@/": the tests load this through Node's type stripper, which
// cannot resolve the tsconfig path alias.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Saying what a session was like, afterwards.
 *
 * The site knows who signed up, who actually turned up, and what people wanted
 * to ask. It has never known whether the morning was any good. This is that
 * missing half: one short form per session, and the numbers that let one
 * Thursday be compared with another.
 *
 * Everything in here is a pure rule with no database and no clock, same as
 * `checkin.ts` — the routes and pages feed it dates and rows, and it answers
 * whether a link still works and what a run of sessions adds up to.
 */

/** What somebody can say about bringing a friend. Order is worst to best. */
export const RECOMMEND = ["no", "maybe", "yes"] as const;
export type Recommend = (typeof RECOMMEND)[number];

/** The rating scale, as the form renders it. */
export const RATINGS = [1, 2, 3, 4, 5] as const;

export function isRecommend(value: string | null | undefined): value is Recommend {
  return RECOMMEND.includes(value as Recommend);
}

/** 1 to 5, or null for "did not answer". Anything else is not a rating. */
export function parseRating(value: string | null | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Same length and same reasoning as the check-in code. */
const CODE_LENGTH = 10;

/**
 * MEMBER_SECRET if set, otherwise ADMIN_TOKEN.
 *
 * ⚠️ Deliberately a second copy of the same three lines in `checkin.ts` rather
 * than an import: check-in is the one flow on this site that must not acquire
 * new dependencies, and sharing a helper would mean editing it to add this.
 * The copy is safe because the two codes are kept apart by the label inside
 * the HMAC, not by the key — and `tests/feedback.test.mts` asserts that both
 * modules still read the same environment, so the copies cannot drift apart
 * silently.
 */
function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;

  if (!key) {
    throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; feedback is disabled");
  }

  return key;
}

/** True for a well-formed calendar date such as 2026-09-24, and nothing else. */
export function isSessionDate(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  // Reject 2026-02-31: Date.UTC rolls it into March, so the round trip differs.
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

/**
 * The code that opens one session's feedback form.
 *
 * ★ `vt.feedback.v1:` is not decoration. The check-in code for the same
 * Thursday is an HMAC of `vt.checkin.v1:<date>` under the same key, and the
 * label is the only thing standing between the two: without it, the link
 * handed round after a session would also be a working check-in code for it.
 */
export function feedbackCode(session: string, key: string = secret()): string {
  return createHmac("sha256", key)
    .update(`vt.feedback.v1:${session}`)
    .digest("base64url")
    .slice(0, CODE_LENGTH);
}

/** Constant-time check of a code presented for a session. */
export function verifyFeedbackCode(
  session: string,
  code: string | undefined | null,
  key: string = secret(),
): boolean {
  if (!code || !isSessionDate(session)) return false;

  const a = Buffer.from(code);
  const b = Buffer.from(feedbackCode(session, key));

  return a.length === b.length && timingSafeEqual(a, b);
}

const DAY = 24 * 60 * 60 * 1000;

/** How long after a session its form stays open. */
export const WINDOW_DAYS = 7;

/**
 * Whether `session` can still be given feedback on when the Sydney date is
 * `today`: from the morning itself until the next Thursday comes round.
 *
 * ★ Not same-day-only, which is the rule check-in uses. The two records are
 * answering different questions: check-in is "were you in the room", which is
 * only true on the day, while this is "what did you think", which arrives that
 * afternoon, that evening, and over the weekend when somebody finally reads
 * the message in the group.
 *
 * ⚠️ It does close, though, and before the next session rather than never.
 * A row of feedback has to belong to exactly one Thursday; an old link left in
 * the group would otherwise quietly file next week's impressions under last
 * week's morning, and nothing in the data would show it had happened.
 *
 * Never open before the session: there is nothing to say about a morning that
 * has not happened.
 */
export function canGiveFeedback(session: string, today: string): boolean {
  if (!isSessionDate(session) || !isSessionDate(today)) return false;

  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${session}T00:00:00Z`)) / DAY,
  );

  return days >= 0 && days < WINDOW_DAYS;
}

/** One submitted form, as the summary needs it. */
export type FeedbackRow = {
  session: string;
  /** 1-5, or null when skipped. */
  rating: number | null;
  recommend: Recommend | null;
};

export type FeedbackSummary = {
  session: string;
  /** Every form handed in for that session. */
  count: number;
  /** How many of them answered the rating question. */
  rated: number;
  /** Mean of the ratings given, to one decimal. Null when nobody rated. */
  average: number | null;
  /** How many answered the "bring a friend" question at all. */
  asked: number;
  /** Of those, how many said yes. */
  yes: number;
};

/**
 * Per-session totals, newest session first.
 *
 * ⚠️ The denominators are the people who answered *that* question, not the
 * number of forms. Counting a skipped rating as a zero would drag an average
 * down for a reason that has nothing to do with the morning, and it is exactly
 * the kind of error that is invisible once it is a number on a dashboard —
 * hence `rated` and `asked` being carried out alongside, so the page can say
 * what a figure is out of.
 */
export function summarise(rows: readonly FeedbackRow[]): FeedbackSummary[] {
  const bySession = new Map<string, FeedbackSummary & { total: number }>();

  for (const row of rows) {
    const entry = bySession.get(row.session) ?? {
      session: row.session,
      count: 0,
      rated: 0,
      average: null,
      asked: 0,
      yes: 0,
      total: 0,
    };

    entry.count += 1;

    if (row.rating !== null) {
      entry.rated += 1;
      entry.total += row.rating;
    }

    if (row.recommend !== null) {
      entry.asked += 1;
      if (row.recommend === "yes") entry.yes += 1;
    }

    bySession.set(row.session, entry);
  }

  return [...bySession.values()]
    .map(({ total, ...entry }) => ({
      ...entry,
      // Guarded rather than trusted: `0/0` is NaN, and a NaN rendered into a
      // table reads as a broken page rather than as "nobody answered".
      average: entry.rated > 0 ? Math.round((total / entry.rated) * 10) / 10 : null,
    }))
    .sort((a, b) => b.session.localeCompare(a.session));
}
