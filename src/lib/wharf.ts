// Relative, not "@/": the tests load this through Node's type stripper, which
// does not read tsconfig's path aliases.
import type { Lang } from "./content.ts";
import { formatSession } from "./sessions.ts";

/**
 * The Wharf — what people said they wanted to ask, gathered in one place.
 *
 * There is no new input anywhere on the site for this. The sentence comes from
 * the sign-up form's "what do you most want to talk about, or ask, this week",
 * which four sessions of copy work took from a 19% fill rate to 80%. Until this
 * page existed, almost none of those sentences were visible anywhere: the
 * member card only surfaces one while its owner is signed up for the *next*
 * Thursday, so between one session ending and the next week's signups opening,
 * the site showed none of them at all.
 *
 * So this file is a read model over data the site already had. It holds no
 * privacy rules of its own on purpose — the only rows it ever sees are the ones
 * `listWallMembers()` returns, and that query filters on `published_at IS NOT
 * NULL AND NOT hidden` in SQL. Someone who never ticked "put me on the member
 * wall" cannot reach this code path, which is what the sign-up form promised
 * them.
 */

/** The fields the Wharf reads. A subset of `Member`, so the tests need no database. */
export type TopicSource = {
  slug: string;
  display_name: string;
  topic: string | null;
  /** Every session this person signed up for, oldest first. */
  sessions: string[];
};

export type WharfEntry = {
  slug: string;
  name: string;
  topic: string;
};

export type WharfGroup = {
  /** ISO date, or null for people who signed up without picking a Thursday. */
  session: string | null;
  entries: WharfEntry[];
};

/**
 * Which session a topic belongs to: the latest one the person signed up for.
 *
 * ⚠️ This is the only attribution the data supports, and it is worth being
 * precise about why. `signups.topic` is a single column that is *overwritten*
 * every time someone signs up again — `sessions` accumulates, `topic` does not.
 * So a regular who has been to four sessions has four dates and one sentence,
 * and that sentence was written when they registered for the most recent of
 * them. Filing it under any earlier date would put words in their mouth about a
 * week they wrote nothing for.
 */
export function topicSession(sessions: string[]): string | null {
  let latest: string | null = null;

  for (const session of sessions) {
    if (!session) continue;
    if (latest === null || session > latest) latest = session;
  }

  return latest;
}

/**
 * Groups topics by the session they were written for, newest first.
 *
 * `upcoming` leads even when nobody has signed up for it yet: an empty "this
 * Thursday" is a true statement on a Friday, and it is also the sentence that
 * makes the page's ask obvious. Past sessions follow, capped at `pastSessions`
 * — the overflow is returned as a count rather than silently dropped, because a
 * page that quietly stops at four groups reads as "that is all there ever was".
 *
 * People with no session at all come last. They are the ones who picked "I can
 * never do Thursday mornings", and they are exactly who this page should not
 * lose track of.
 */
export function groupTopics(
  members: readonly TopicSource[],
  upcoming: string,
  pastSessions = 3,
): { groups: WharfGroup[]; total: number; olderSessions: number; olderEntries: number } {
  const bySession = new Map<string, WharfEntry[]>();
  const undated: WharfEntry[] = [];
  let total = 0;

  for (const member of members) {
    const topic = member.topic?.trim();
    if (!topic) continue;

    total += 1;
    const entry: WharfEntry = { slug: member.slug, name: member.display_name, topic };
    const session = topicSession(member.sessions);

    if (session === null) {
      undated.push(entry);
      continue;
    }

    const list = bySession.get(session);
    if (list) list.push(entry);
    else bySession.set(session, [entry]);
  }

  // Anything dated later than the next Thursday is folded into it. That only
  // happens when someone signs up two or three weeks ahead, and giving each of
  // those a group of its own would push this week's — the one people came to
  // read — below a run of nearly empty headings.
  const future: WharfEntry[] = [];
  const past: string[] = [];

  for (const session of bySession.keys()) {
    if (session >= upcoming) future.push(...bySession.get(session)!);
    else past.push(session);
  }

  past.sort((a, b) => (a < b ? 1 : -1));

  const shown = past.slice(0, pastSessions);
  const hidden = past.slice(pastSessions);

  const groups: WharfGroup[] = [{ session: upcoming, entries: future }];

  for (const session of shown) {
    groups.push({ session, entries: bySession.get(session)! });
  }

  if (undated.length > 0) groups.push({ session: null, entries: undated });

  return {
    groups,
    total,
    olderSessions: hidden.length,
    olderEntries: hidden.reduce((sum, session) => sum + bySession.get(session)!.length, 0),
  };
}

/**
 * The few questions the home page shows.
 *
 * Walks the groups in the order they are already in, so this Thursday's come
 * first and older ones fill the rest. Falling through like that rather than
 * showing only this week's is what keeps the block from being empty on a
 * Friday — the week's sign-ups have not started, but the questions from the
 * session that just happened are still perfectly good advertising for what
 * this page is.
 */
export function featuredTopics(groups: readonly WharfGroup[], limit = 3): WharfEntry[] {
  const picked: WharfEntry[] = [];

  for (const group of groups) {
    for (const entry of group.entries) {
      if (picked.length === limit) return picked;
      picked.push(entry);
    }
  }

  return picked;
}

/**
 * The line the seagull says, keyed off what is actually on the page.
 *
 * It is a status readout wearing a joke: the meme it comes from — "today is so
 * boring… might as well go down the wharf for chips" — happens to describe the
 * exact behaviour this page needs from the people who could answer something.
 * Somebody idle, wandering over to see what is going on.
 *
 * Deadpan on purpose. The rest of the site does not use exclamation marks and
 * neither does the bird.
 */
export function gullMood(thisWeek: number, total: number): "waiting" | "quiet" | "empty" {
  if (thisWeek > 0) return "waiting";
  if (total > 0) return "quiet";
  return "empty";
}

/** "9月3日（周四）" / "Thu 3 Sep", or the label for people with no session. */
export function groupLabel(
  session: string | null,
  upcoming: string,
  lang: Lang,
  copy: { thisWeek: string; noSession: string },
): string {
  if (session === null) return copy.noSession;
  if (session === upcoming) return copy.thisWeek;
  return formatSession(session, lang);
}
