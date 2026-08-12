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
  /** Of those, the ones this is the first session for. */
  firstTimers: number;
  /** Of those, the ones who said they want to demo. */
  wantsToDemo: number;
};

/**
 * Signups grouped by the session they picked.
 *
 * Signups are upserted, so a returning person adds a date to `sessions` on
 * their existing row rather than creating a new one — which is why a headcount
 * for a given Thursday can only be read from that array, never from
 * `created_at` or `first_session` (the latter is only the most recent pick).
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

    const created: SessionCount = { date, total: 0, firstTimers: 0, wantsToDemo: 0 };
    byDate.set(date, created);
    return created;
  };

  for (const date of seedDates) rowFor(date);

  for (const signup of signups) {
    // Sort defensively rather than trusting the caller: "first session" is the
    // number this whole table exists for, and getting it from an out-of-order
    // array would be wrong in a way nobody would notice.
    const ordered = [...new Set(signup.sessions)].sort();
    const earliest = ordered[0];

    for (const date of ordered) {
      const session = rowFor(date);
      session.total += 1;
      if (date === earliest) session.firstTimers += 1;
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
