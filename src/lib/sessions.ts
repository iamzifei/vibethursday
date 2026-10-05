// Relative, not "@/": these are loaded by the tests through Node's type
// stripper, which does not read tsconfig's path aliases.
import type { Lang } from "./content.ts";

/**
 * Session date helpers.
 *
 * Every date shown on this site is a Sydney date. The app is hosted in
 * Singapore, so we must never read the server clock's local calendar day —
 * the two time zones differ by 2-3 hours and would disagree about which day
 * "today" is for part of every day. All calculations therefore go through
 * Intl with an explicit Australia/Sydney time zone.
 */

const SYDNEY = "Australia/Sydney";

/** Thursday, in JavaScript's 0=Sunday day-of-week numbering. */
const THURSDAY = 4;

/**
 * Returns today's Sydney calendar date, expressed as a UTC-midnight Date.
 *
 * Anchoring on UTC midnight lets us do plain day arithmetic afterwards without
 * daylight-saving shifts (Sydney observes DST) moving a date across a boundary.
 */
export function sydneyToday(): Date {
  // en-CA formats as YYYY-MM-DD, which is what we want to parse back.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [year, month, day] = parts.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The date of the first session that actually runs.
 *
 * Without this the form would happily take a signup for the Thursday that
 * happens to be next on the calendar, including ones before the meetup has
 * launched. Set FIRST_SESSION_DATE (YYYY-MM-DD) to move it; the fallback is
 * the planned launch date.
 */
const FIRST_SESSION = process.env.FIRST_SESSION_DATE || "2026-08-06";

/** The launch date, for anything that describes the series as a whole. */
export const FIRST_SESSION_DATE = FIRST_SESSION;

/** Sydney hour of day, 0-23. */
export function sydneyHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: SYDNEY,
    hour: "2-digit",
    hour12: false,
  }).format(new Date()));
}

/**
 * Doors and the session proper are both at 10:30 (the venue opens then);
 * either way it is over by 12:00, which is all this constant needs to know.
 *
 * Keep this in step with the times in `content.ts` — people may stay on
 * afterwards, and usually do, but that is not part of the session anyone signs
 * up for.
 */
const SESSION_END_HOUR = 12;

/**
 * The next `count` Thursdays that are being run, as ISO date strings.
 *
 * If today is Thursday, today is included — someone finding the site on a
 * Thursday morning should be able to sign up for that afternoon. Thursdays
 * earlier than FIRST_SESSION are skipped rather than offered.
 */
export function nextThursdays(count = 6): string[] {
  const today = sydneyToday();
  let daysUntilThursday = (THURSDAY - today.getUTCDay() + 7) % 7;

  // On a Thursday afternoon the session has already happened, so offering it
  // would take signups for something that is over. Roll to next week instead.
  if (daysUntilThursday === 0 && sydneyHour() >= SESSION_END_HOUR) {
    daysUntilThursday = 7;
  }

  const upcoming: string[] = [];

  // Walk forward a week at a time until `count` runnable sessions are found.
  // The cap is a backstop against an accidentally far-future FIRST_SESSION
  // turning this into an unbounded loop.
  for (let week = 0; week < count + 104 && upcoming.length < count; week += 1) {
    const session = new Date(today);
    session.setUTCDate(today.getUTCDate() + daysUntilThursday + week * 7);

    const iso = session.toISOString().slice(0, 10);
    if (iso >= FIRST_SESSION) upcoming.push(iso);
  }

  return upcoming;
}

/**
 * Sessions that are not the weekly Thursday — Build Tuesday so far.
 *
 * Decided 2026-10-04: Thursday has outgrown a single room, so people who
 * build things get a second morning of their own: a small closed room, laptops
 * open, looking at each other's work rather than a stage. It exists to take
 * some of Thursday's crowd, not to add to it.
 *
 * A list in code rather than a table: there is one of these so far, each is
 * booked by hand, and a row in the database would need every page that reads
 * sessions to learn a new shape. Add an entry here when the next room is
 * booked. Where and when it is, in words, lives in `copy.tuesday`.
 *
 * ⚠️ Never on a Thursday. Every per-date table on the site (headcounts,
 * check-ins, the waitlist) is keyed on the date alone, so a special session on
 * a Thursday would be counted together with that week's meetup.
 */
export type SpecialSession = {
  /** Sydney date, YYYY-MM-DD. */
  date: string;
  kind: "tuesday";
  /** Sydney hour the session ends; after it the date is no longer offered. */
  endHour: number;
  /** Signups taken before the waitlist starts. The room seats about fifteen. */
  cap: number;
};

export const SPECIAL_SESSIONS: readonly SpecialSession[] = [
  { date: "2026-10-06", kind: "tuesday", endHour: 12, cap: 15 },
  { date: "2026-10-13", kind: "tuesday", endHour: 12, cap: 15 },
];

/** Whether a date is one of the special sessions above. */
export function isSpecialSession(date: string): boolean {
  return SPECIAL_SESSIONS.some((session) => session.date === date);
}

/**
 * Special sessions that can still be booked, soonest first.
 *
 * Pure in (today, hour) so the tests can stand on any day. Same rollover as a
 * Thursday: offered up to the morning itself, gone once it has ended.
 */
export function openSpecialSessions(today: string, hour: number): SpecialSession[] {
  return SPECIAL_SESSIONS.filter(
    (session) => session.date > today || (session.date === today && hour < session.endHour),
  ).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** `openSpecialSessions` against the real Sydney clock. */
export function upcomingSpecialSessions(): SpecialSession[] {
  return openSpecialSessions(sydneyToday().toISOString().slice(0, 10), sydneyHour());
}

/**
 * Every date someone can sign up for: the next `count` Thursdays plus any
 * special session still open, in date order.
 *
 * ★ The whitelist for every route that books a date. Until 2026-10-04 they all
 * checked `nextThursdays()`, which would have quietly stored a Tuesday signup
 * as "no session" while telling the person they were in.
 */
export function bookableSessions(count = 6): string[] {
  return [...nextThursdays(count), ...upcomingSpecialSessions().map((session) => session.date)].sort();
}

/**
 * How close the next session has to be before the wall looks forward.
 *
 * Three days puts the switch on the Sunday/Monday boundary: Monday through
 * Thursday the wall is about the session coming up, Thursday noon through
 * Sunday it is about the one that just happened.
 */
const LOOK_AHEAD_DAYS = 3;

/**
 * Which session the member wall should be grouped around right now.
 *
 * Deliberately not `nextThursdays(1)[0]`, which is right for the signup form
 * and wrong here. That value rolls over to next week at noon on a Thursday —
 * so the moment a session ended, everyone who had been at it dropped out of
 * the wall's first group and the page fell back to one flat list.
 *
 * Measured 2026-08-27 21:50, the evening of the fourth session: the wall's
 * only heading was "所有成员". The people who had spent the morning together
 * were no longer grouped anywhere, and lunch — when someone is trying to work
 * out who it was they had just been talking to — is exactly when that grouping
 * is worth the most. The page was turning itself off during its best hours.
 *
 * The rule is "whichever Thursday is nearer", which needs no story about how
 * long a memory lasts: within three days of the next session the wall looks
 * forward, otherwise it looks back at the last one.
 *
 * Never returns a Thursday before the meetup existed — early on there is no
 * previous session to look back at, so the next one stands.
 */
export function sessionInFocus(nextSession: string, today: string): string {
  const day = 24 * 60 * 60 * 1000;
  const daysAway = Math.round(
    (Date.parse(`${nextSession}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / day,
  );

  if (daysAway <= LOOK_AHEAD_DAYS) return nextSession;

  const previous = new Date(`${nextSession}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 7);

  const iso = previous.toISOString().slice(0, 10);
  return iso >= FIRST_SESSION ? iso : nextSession;
}

/**
 * `sessionInFocus` against the real clock, plus which way it is looking.
 *
 * `past` is derived from the same call rather than by comparing the date with
 * today, because on a Thursday evening the session in focus *is* today and a
 * date comparison would call that "upcoming" — the one case the whole helper
 * exists for. Reading it off the branch that was actually taken cannot drift.
 */
export function focusSession(): { date: string; past: boolean } {
  const next = nextThursdays(1)[0];
  const date = sessionInFocus(next, sydneyToday().toISOString().slice(0, 10));

  return { date, past: date !== next };
}

/** Formats an ISO date for display, e.g. "8月13日（周四）" or "Thu 13 Aug". */
export function formatSession(isoDate: string, lang: Lang): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  if (lang !== "en") {
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    // The weekday comes from the date: until Build Tuesday every session was
    // a Thursday and this said 周四 whatever the date was.
    const formatted = `${month}月${day}日（周${"日一二三四五六"[date.getUTCDay()]}）`;

    // Built here rather than read from the copy bundle, so it misses the
    // conversion that bundle gets: 周 is 週 in Traditional.
    //
    // ⚠️ One character swapped by hand, deliberately NOT the converter. This
    // file is imported by client code (the weekly poster, via poster-card),
    // and importing the converter here put its whole dictionary into that
    // bundle. 月, 日 and the weekday digits are identical in both scripts, so 周 is the only
    // character this string can ever contain that differs — and
    // `tests/session-focus.test.mts` checks that against the real converter.
    return lang === "zh-Hant" ? formatted.replace("周", "週") : formatted;
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/**
 * A session's date plus, for a special session, its name — "10月6日（周二）·
 * Build Tuesday". For lists where both kinds sit side by side (/my), so a
 * Tuesday does not read as a Thursday that moved. The name is a proper noun
 * and the same in every language.
 */
export function sessionName(isoDate: string, lang: Lang): string {
  const date = formatSession(isoDate, lang);
  return isSpecialSession(isoDate) ? `${date} · Build Tuesday` : date;
}

/**
 * The session the organiser's check-in desk (/admin, /admin/door) is set up
 * for: a special session on its own day, otherwise `focusSession`.
 *
 * On a Build Tuesday `focusSession` is still looking ahead to Thursday, which
 * is right for the member wall and wrong for the desk — the people walking in
 * that morning are the Tuesday's. All day rather than until it ends, for the
 * same reason the desk looks back on a Thursday afternoon: that is when a
 * no-show or a missed check-in gets fixed up.
 */
export function deskSession(): string {
  const today = sydneyToday().toISOString().slice(0, 10);
  return isSpecialSession(today) ? today : focusSession().date;
}

/**
 * The other dates in `held` that fall in the same Monday–Sunday week as `date`.
 *
 * One morning a week (James 2026-10-05): a week's Build Tuesday and its
 * Thursday are alternatives, not a pair — signing up for one gives up the
 * other, so each room keeps its places for people who will actually use them.
 * Pure, so the rule is tested without a clock or a database.
 */
export function sameWeekSessions(date: string, held: readonly string[]): string[] {
  const monday = (iso: string) => {
    const day = new Date(`${iso}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day.toISOString().slice(0, 10);
  };
  const week = monday(date);
  return [...new Set(held)].filter((other) => other !== date && /^\d{4}-\d{2}-\d{2}$/.test(other) && monday(other) === week);
}
