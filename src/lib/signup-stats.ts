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

/** The fields the per-session composition reads. Structural, like `CountableSignup`. */
export type ComposableSignup = {
  /** Sessions this person has a place in. Waitlisted sessions are not here. */
  sessions: string[];
  ai_level: string | null;
  industry: string | null;
  /** Why they came, per session, as "2026-09-24=biz 2026-10-01=learn" (`listSignups`). */
  purposes: string;
};

/** Answer value → how many people gave it. Unanswered is kept apart, never a key here. */
export type Tally = Record<string, number>;

export type SessionComposition = {
  date: string;
  /** Everyone with a place in this session — the same number `countPerSession` gives. */
  total: number;
  aiLevel: Tally;
  industry: Tally;
  purpose: Tally;
  /** How many left each question blank, so a tally is never read against the wrong total. */
  unanswered: { aiLevel: number; industry: number; purpose: number };
};

/**
 * Who is in each session's room: how many people per AI-familiarity level,
 * per industry and per "what I want to take away", for the given dates.
 *
 * Counts only people with a place (`sessions`), like every other headcount on
 * /admin — a waitlisted person is not in the room.
 *
 * AI level and industry are one answer per person, so someone who comes to
 * three sessions is counted with the same answer in all three. The purpose is
 * per session, read from that session's entry only.
 *
 * Blank answers go into `unanswered` rather than into the tallies: every row
 * from before these questions existed is blank, and counting that as an answer
 * would make the room look like something it is not.
 */
export function compositionPerSession(
  signups: readonly ComposableSignup[],
  dates: readonly string[],
): SessionComposition[] {
  const byDate = new Map<string, SessionComposition>(
    dates.map((date) => [
      date,
      {
        date,
        total: 0,
        aiLevel: {},
        industry: {},
        purpose: {},
        unanswered: { aiLevel: 0, industry: 0, purpose: 0 },
      },
    ]),
  );

  for (const signup of signups) {
    // "date=value" pairs, space-separated. Values are whitelisted codes with no
    // spaces or "=", so a plain split is exact.
    const purposeFor = new Map(
      signup.purposes
        .split(" ")
        .filter(Boolean)
        .map((pair) => pair.split("=") as [string, string]),
    );

    // Deduplicated, so a date stored twice cannot count someone twice.
    for (const date of new Set(signup.sessions)) {
      const row = byDate.get(date);
      if (!row) continue;

      row.total += 1;
      tally(row, "aiLevel", signup.ai_level);
      tally(row, "industry", signup.industry);
      tally(row, "purpose", purposeFor.get(date) ?? null);
    }
  }

  return dates.map((date) => byDate.get(date)!);
}

function tally(row: SessionComposition, field: "aiLevel" | "industry" | "purpose", value: string | null) {
  if (!value) {
    row.unanswered[field] += 1;
    return;
  }
  row[field][value] = (row[field][value] ?? 0) + 1;
}

/** What the Build Tuesday split needs from a signup row. */
export type SplitSignup = {
  sessions: readonly string[];
  waitlist: readonly string[];
  /** "2026-09-24=biz 2026-10-06=tech", as listSignups flattens it. */
  purposes: string;
};

export type TuesdaySplit = {
  tuesday: string;
  thursday: string;
  /** Booked on the Tuesday, and on its waitlist. */
  tuesdayBooked: number;
  tuesdayWaitlist: number;
  /** Booked on that week's Thursday. */
  thursdayBooked: number;
  /** Down for the Tuesday and not that week's Thursday — the ones it took. */
  tuesdayOnly: number;
  /** Down for both. */
  both: number;
  /** Of the Tuesday's signups, came to or signed up for an earlier session. */
  regulars: number;
  /** Of the Tuesday's signups, said "product" or "tech" for it — the builders it is for. */
  builders: number;
};

/**
 * Whether Build Tuesday is doing its job (2026-10-05): taking people off that
 * week's Thursday rather than adding a second crowd. Counted per Tuesday,
 * against the Thursday two days later.
 *
 * "Down for" means booked or waitlisted. Someone who moved from Thursday to
 * Tuesday on /my shows up as Tuesday-only — the move removes the Thursday —
 * so tuesdayOnly is the number to watch.
 */
export function tuesdaySplit(rows: readonly SplitSignup[], tuesday: string): TuesdaySplit {
  const thursdayDate = new Date(`${tuesday}T00:00:00Z`);
  thursdayDate.setUTCDate(thursdayDate.getUTCDate() + 2);
  const thursday = thursdayDate.toISOString().slice(0, 10);

  const split: TuesdaySplit = {
    tuesday,
    thursday,
    tuesdayBooked: 0,
    tuesdayWaitlist: 0,
    thursdayBooked: 0,
    tuesdayOnly: 0,
    both: 0,
    regulars: 0,
    builders: 0,
  };

  for (const row of rows) {
    const onTuesday = row.sessions.includes(tuesday) || row.waitlist.includes(tuesday);
    const onThursday = row.sessions.includes(thursday) || row.waitlist.includes(thursday);
    if (row.sessions.includes(thursday)) split.thursdayBooked += 1;
    if (!onTuesday) continue;

    if (row.sessions.includes(tuesday)) split.tuesdayBooked += 1;
    else split.tuesdayWaitlist += 1;
    if (onThursday) split.both += 1;
    else split.tuesdayOnly += 1;
    if (row.sessions.some((date) => date < tuesday)) split.regulars += 1;

    const purpose = new RegExp(`(?:^|\\s)${tuesday}=(\\w+)`).exec(row.purposes)?.[1];
    if (purpose === "product" || purpose === "tech") split.builders += 1;
  }

  return split;
}
