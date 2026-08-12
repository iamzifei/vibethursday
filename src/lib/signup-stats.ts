/**
 * Counting helpers for the signup table.
 *
 * These live outside the /admin page so they can be tested without a database
 * or a React render. They take plain rows and return plain numbers.
 */

/** The shape of a signup row these counts need. Kept structural on purpose so
 *  the tests can build one without importing the database module. */
export type CountableSignup = {
  /** Every session this person signed up for, oldest first. */
  sessions: string[];
  demo_intent: string | null;
};

export type SessionCount = {
  date: string;
  /** Everyone whose signup includes this date. */
  total: number;
  /** Of those, the ones who said they want to demo. */
  wantsToDemo: number;
};

/*
 * There is deliberately no "first timers" count here.
 *
 * It looks derivable — the earliest date in someone's `sessions` — but that is
 * not when they arrived, it is the earliest session the form could still offer
 * them, because past Thursdays are never selectable. Someone who signed up the
 * day after a session shows up as a first-timer for the next one, however long
 * they have been around.
 *
 * Measured 2026-08-12: 26 people had 2026-08-13 as their earliest session, and
 * all 26 were already in the WeChat group. The real increment that day was 1.
 * That gap is not a rounding error, and a column claiming otherwise on this
 * page would be read as the number to pull people into the group by.
 *
 * Who is actually new is the set of WeChat handles not yet in
 * `sydney-meetup/data/已处理微信号.txt` — a question this database cannot
 * answer, since it does not know who is in the group.
 */

/**
 * Signups grouped by the session they picked.
 *
 * Signups are upserted, so a returning person adds a date to `sessions` on
 * their existing row rather than creating a new one — which is why a headcount
 * for a given Thursday can only be read from that array, never from
 * `created_at` or `first_session` (the latter is only the most recent pick).
 *
 * These are signups, not turnout: the first session ran at roughly 70-77% of
 * its number.
 *
 * `seedDates` are always returned, at zero if nobody has signed up for them
 * yet, so an upcoming session shows as an empty row rather than disappearing.
 *
 * Ordered upcoming-first (soonest first), then past sessions most recent
 * first, since the rows worth looking at are the ones nearest to now. The
 * boundary between the two is the first seed date, i.e. the next session that
 * is actually being run.
 */
export function countPerSession(
  signups: readonly CountableSignup[],
  seedDates: readonly string[],
): SessionCount[] {
  const byDate = new Map<string, SessionCount>();

  const rowFor = (date: string) => {
    const existing = byDate.get(date);
    if (existing) return existing;

    const created: SessionCount = { date, total: 0, wantsToDemo: 0 };
    byDate.set(date, created);
    return created;
  };

  for (const date of seedDates) rowFor(date);

  for (const signup of signups) {
    // Deduplicated so a date stored twice cannot inflate a headcount.
    for (const date of new Set(signup.sessions)) {
      const session = rowFor(date);
      session.total += 1;
      if (signup.demo_intent === "yes") session.wantsToDemo += 1;
    }
  }

  const cutoff = seedDates[0] ?? "";
  const all = [...byDate.values()];

  return [
    ...all.filter((s) => s.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date)),
    ...all.filter((s) => s.date < cutoff).sort((a, b) => b.date.localeCompare(a.date)),
  ];
}
