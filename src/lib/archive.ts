// Relative, not "@/": the tests load this through Node's type stripper, which
// does not read tsconfig's path aliases.
import type { Lane } from "./questions.ts";

/**
 * The archive: one row per session that has happened.
 *
 * Until this existed, a session was not a thing on this site — it was a date
 * that three separate pages each knew a different piece of. The photos were on
 * the home page, the questions were on the Wharf, and who came was on the
 * member wall sorted by recency rather than by session. Nothing anywhere could
 * answer "what happened on the third Thursday".
 *
 * Questions come in already loaded rather than being re-derived from the
 * member wall. There is exactly one place a question exists — `wharf_questions`
 * — and the archive showing a different set from the Wharf would be the kind
 * of drift that is invisible until somebody notices two pages disagreeing.
 *
 * ★ This file does not count signups, and still does not. Headcounts from
 * before check-in existed stay in the hand-written note on each session,
 * because that note says both numbers — how many signed up and how many turned
 * up — and those are measurably different. A live "N signed up" printed next
 * to a photo of the room would be a signup count wearing an attendance count's
 * clothes.
 *
 * The one attendance figure here — `attended` — is the count of people who
 * checked in on the day, passed in from the check-in table. It is the only
 * number on this site that measures who was in the room, and it exists only
 * for sessions since check-in started; earlier rows carry null, not zero.
 *
 * The other number is how many people **with a published card** signed up
 * for that session. It is not attendance, and it is labelled as what it is.
 *
 * A session with check-ins but no entry in the copy bundle yet — today's, on
 * the day — is still a row: title and photos come later, the people came now.
 */

/** A session as `content.ts` describes it. Photos and prose, no numbers. */
export type ArchiveSession = {
  date: string;
  title: string;
  note: string;
  photos: readonly { src: string; alt: string; width: number; height: number }[];
};

export type ArchiveRow = {
  date: string;
  /** 1-based, by date, across every session including ones not yet written up. */
  index: number;
  /** Null until the session has been written up in the copy bundle. */
  title: string | null;
  note: string | null;
  /**
   * The painted poster for that morning, without a width or an extension.
   *
   * Numbered by ascending date among the written-up sessions, which has to
   * match `scripts/session-poster.mjs` exactly: it is the same numbering for
   * the same reason — adding an older session must not silently repoint every
   * other session's picture. Null for a session that has no write-up yet.
   */
  poster: string | null;
  photos: ArchiveSession["photos"];
  /** How many checked in on the day. Null before check-in existed. */
  attended: number | null;
  /** What was on the Wharf for that session, in wall order. */
  questions: { slug: string; name: string; topic: string }[];
  /** People with a published card who signed up for that session. */
  people: { slug: string; name: string }[];
};

/**
 * Joins the sessions in the copy bundle to the member wall.
 *
 * Newest first, which is the order the home page's albums already use and the
 * order anyone reads an archive in.
 *
 * `members` must be the published wall — the same rows `listWallMembers()`
 * returns. Nothing here re-checks that, because nothing here can: this file
 * never touches a database. The gate lives in the query, and the page is what
 * has to keep using it.
 */
export function buildArchive(
  sessions: readonly ArchiveSession[],
  members: readonly { slug: string; display_name: string; sessions: string[] }[],
  questions: readonly {
    slug: string;
    name: string;
    text: string;
    session: string | null;
    lane: Lane;
  }[],
  attendance: ReadonlyMap<string, number> = new Map(),
): ArchiveRow[] {
  const written = [...sessions]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((session, index) => ({
      ...session,
      poster: `/sessions/session-${String(index + 1).padStart(2, "0")}`,
    }));

  // A session that only the check-in table knows about yet.
  const unwritten = [...attendance.keys()]
    .filter((date) => !sessions.some((session) => session.date === date))
    .map((date) => ({ date, title: null, note: null, poster: null, photos: [] as ArchiveSession["photos"] }));

  const numbered = [...written, ...unwritten]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((session, index) => ({ ...session, index: index + 1 }));

  return numbered
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((session) => ({
      ...session,
      attended: attendance.get(session.date) ?? null,
      // Only the answerable lane. The archive is a record of what a morning
      // was about, and "I came to meet people" — true and useful as it is on
      // the wall — is not what that row is for.
      questions: questions
        .filter((question) => question.lane === "question" && question.session === session.date)
        .map((question) => ({ slug: question.slug, name: question.name, topic: question.text })),
      people: members
        .filter((member) => member.sessions.includes(session.date))
        .map((member) => ({ slug: member.slug, name: member.display_name })),
    }));
}

/**
 * The numbers at the top of the archive.
 *
 * Every one of them is countable from something already public, and every one
 * is labelled as what it actually counts. ⚠️ `signups` is people who have ever
 * signed up — not attendances, and not who turned up. Four sessions in, those
 * are three different numbers, and the site has only ever been able to measure
 * the first.
 */
export function archiveTotals(
  rows: readonly ArchiveRow[],
  cards: number,
  signups: number,
  questions: number,
): { sessions: number; signups: number; cards: number; questions: number } {
  return { sessions: rows.length, signups, cards, questions };
}
