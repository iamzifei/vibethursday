import { sessionHeadcount } from "./db.ts";
import { isSpecialSession, sameWeekSessions, upcomingSpecialSessions } from "./sessions.ts";

/**
 * Whether the week of `session` has a Build Tuesday that still has places —
 * the condition under which a builder is sent there and gets only the
 * Thursday's waitlist (`builderToWaitlist`, James 2026-10-06). Shared by the
 * signup route and /my so the two can never disagree.
 */
export async function sameWeekTuesdayOpen(session: string): Promise<boolean> {
  if (isSpecialSession(session)) return false;
  for (const special of upcomingSpecialSessions()) {
    if (sameWeekSessions(session, [special.date]).length === 0) continue;
    if ((await sessionHeadcount(special.date, null, null)).count < special.cap) return true;
  }
  return false;
}
