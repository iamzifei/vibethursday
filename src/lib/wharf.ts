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
 * What is left in this file after questions became rows of their own: the rule
 * for which session a sentence belongs to, which the member card still needs
 * because a card shows the *live* `signups.topic` rather than the archived
 * question, and the seagull's line. Everything else moved to `questions.ts`
 * and `db.ts` when the board stopped being a read model.
 */

/** The fields the session rule reads. */
export type TopicSource = {
  slug: string;
  display_name: string;
  topic: string | null;
  sessions: string[];
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

