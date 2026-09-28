// Relative imports only: the tests load this through Node's type stripper.

/**
 * The weekly board's scoring rules.
 *
 * ★ Every point here is for something the server saw happen itself. The
 * game's older progress — stamps, stars, the streak — lives in each browser's
 * localStorage, and a board built on that would be topped by whoever edits it
 * first (2026-09-28). So the board only counts: a bean the server placed and
 * the server saw you reach, a wave the server saw two people make next to
 * each other, a day the server saw you arrive, a check-in in the database —
 * and, capped hard, the day's tasks, which only the browser can know about.
 *
 * Game-only, reset every Monday, never shown on a member card or anywhere
 * else, never exchanged for anything (James, 2026-09-28). The same rules as
 * the Wharf's closed decision on points, applied to a game where a race is
 * the point.
 */

export const POINTS = {
  /** Reaching a coffee bean first. */
  rush: 10,
  /** High-fiving someone, each. */
  highFive: 3,
  /** First visit of the day. */
  login: 2,
  /** On the third day in a row. */
  streak3: 5,
  /** On every seventh day in a row. */
  streak7: 15,
  /** Each of the day's three tasks. */
  dailyTask: 3,
  /** Being in the room on the Thursday: checked in, on the wall. */
  attended: 50,
} as const;

/** Points in double time (Thursday morning) are multiplied by this. */
export const DOUBLE = 2;

/** Distinct people a player can earn high-five points with in one day. */
export const HIGH_FIVE_PAIRS_PER_DAY = 10;

/** Daily tasks that pay out, per day. */
export const DAILY_TASK_MAX = 3;

export type AwardReason = "rush" | "highfive" | "login" | "streak3" | "streak7" | "daily" | "attended";

/**
 * One line on the ledger. `ref` makes it idempotent: the database refuses a
 * second row with the same week, player, reason and ref, so a repeated request
 * — a double tap, a retry after a dropped connection — pays nothing twice.
 */
export type Award = { reason: AwardReason; ref: string; points: number };

/** The Monday (Sydney date) that starts the week containing `day`. */
export function weekStart(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const back = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

/** Today in Sydney, YYYY-MM-DD. */
export function sydneyDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(now);
}

/**
 * Thursday 10:00–13:00 Sydney: the morning the meetup is on. Points double,
 * beans come faster — the game pulling people back to the real table.
 */
export function isDoubleTime(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return weekday === "Thu" && hour >= 10 && hour < 13;
}

/** Days in a row, ending today. Zero when today is not among them. */
export function streakFromDays(days: readonly string[], today: string): number {
  const have = new Set(days);
  let streak = 0;
  const cursor = new Date(`${today}T12:00:00Z`);
  while (have.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** What today's first visit pays, given the streak including today. */
export function loginAwards(streak: number, today: string): Award[] {
  const awards: Award[] = [{ reason: "login", ref: today, points: POINTS.login }];
  if (streak === 3) awards.push({ reason: "streak3", ref: today, points: POINTS.streak3 });
  if (streak > 0 && streak % 7 === 0) awards.push({ reason: "streak7", ref: today, points: POINTS.streak7 });
  return awards;
}

/** Order-independent key for two players, for "once per pair per day". */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
