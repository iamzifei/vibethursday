// Relative, not "@/": the tests load this through Node's type stripper, which
// does not read tsconfig's path aliases.
import { topicSession, type TopicSource } from "./wharf.ts";

/**
 * The archive: one row per session that has happened.
 *
 * Until this existed, a session was not a thing on this site — it was a date
 * that three separate pages each knew a different piece of. The photos were on
 * the home page, the questions were on the Wharf, and who came was on the
 * member wall sorted by recency rather than by session. Nothing anywhere could
 * answer "what happened on the third Thursday".
 *
 * ★ What this file deliberately does NOT do is count anybody. Headcounts stay
 * in the hand-written note on each session, because that note says both numbers
 * — how many signed up and how many turned up — and those are measurably
 * different. A live "N signed up" printed next to a photo of the room would be
 * a signup count wearing an attendance count's clothes.
 *
 * The one number computed here is how many people **with a published card**
 * signed up for that session. It is not attendance either, and it is labelled
 * as what it is.
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
  title: string;
  note: string;
  /**
   * The painted poster for that morning, without a width or an extension.
   *
   * Numbered by ascending date, which has to match `scripts/session-poster.mjs`
   * exactly: it is the same numbering for the same reason — adding an older
   * session must not silently repoint every other session's picture.
   */
  poster: string;
  photos: ArchiveSession["photos"];
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
  members: readonly (TopicSource & { display_name: string })[],
): ArchiveRow[] {
  const numbered = [...sessions]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((session, index) => ({
      ...session,
      poster: `/sessions/session-${String(index + 1).padStart(2, "0")}`,
    }));

  return numbered
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((session) => {
      const people: ArchiveRow["people"] = [];
      const questions: ArchiveRow["questions"] = [];

      for (const member of members) {
        if (!member.sessions.includes(session.date)) continue;

        people.push({ slug: member.slug, name: member.display_name });

        // A question belongs to one session — the latest one its author signed
        // up for — for the reason set out in `topicSession`. A regular who has
        // been to four sessions has four dates and one sentence, and repeating
        // that sentence under all four would be inventing three of them.
        const topic = member.topic?.trim();
        if (topic && topicSession(member.sessions) === session.date) {
          questions.push({ slug: member.slug, name: member.display_name, topic });
        }
      }

      return { ...session, questions, people };
    });
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
  members: readonly TopicSource[],
  signups: number,
): { sessions: number; signups: number; cards: number; questions: number } {
  return {
    sessions: rows.length,
    signups,
    cards: members.length,
    questions: members.filter((member) => member.topic?.trim()).length,
  };
}
