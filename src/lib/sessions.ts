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
 * The next `count` Thursdays as ISO date strings (YYYY-MM-DD).
 *
 * If today is Thursday, today is included — someone finding the site on a
 * Thursday morning should be able to sign up for that afternoon.
 */
export function nextThursdays(count = 6): string[] {
  const today = sydneyToday();
  const daysUntilThursday = (THURSDAY - today.getUTCDay() + 7) % 7;

  return Array.from({ length: count }, (_, index) => {
    const session = new Date(today);
    session.setUTCDate(today.getUTCDate() + daysUntilThursday + index * 7);
    return session.toISOString().slice(0, 10);
  });
}

/** Formats an ISO date for display, e.g. "8月13日（周四）" or "Thu 13 Aug". */
export function formatSession(isoDate: string, lang: "zh" | "en"): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  if (lang === "zh") {
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${month}月${day}日（周四）`;
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}
