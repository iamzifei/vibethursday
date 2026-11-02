// Relative imports only: the tests load this through Node's type stripper.

/** The fields the waitlist order reads; a SignupRow has them all. */
export type WaitlistRow = {
  id: string;
  waitlist: string[];
  waitlist_since: Record<string, string>;
  created_at: string;
};

/**
 * Who is waiting for `session`, first come first served: by when they joined
 * this waitlist, then id — the same order as the place /my tells people they
 * hold. Not by signup age: that put a regular from months ago ahead of people
 * who had been waiting all day (2026-09-28). Moved here from /admin
 * (2026-11-02) so the waitlist page and the admin overview agree.
 */
export function waitlistFor<T extends WaitlistRow>(rows: readonly T[], session: string): T[] {
  const at = (row: T) => Date.parse(row.waitlist_since[session] ?? `${row.created_at.replace(" ", "T")}:00Z`);
  return rows.filter((row) => row.waitlist.includes(session)).sort((a, b) => at(a) - at(b) || Number(a.id) - Number(b.id));
}
