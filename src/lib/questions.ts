// Relative, not "@/": the tests load this through Node's type stripper.

/**
 * A question on the Wharf, once it is a row rather than a column.
 *
 * `signups.topic` is a single column that gets overwritten every time somebody
 * signs up again. That was survivable while the Wharf only displayed it: the
 * worst case was attributing a sentence to the wrong week. It stops being
 * survivable the moment anything hangs off a question, because an answer would
 * silently end up under a question its author never asked — with no error, and
 * no way to notice. So a question becomes an immutable row the first time it is
 * seen, and editing the form later creates a new one rather than changing the
 * old one.
 */

/**
 * Which lane a question sits in.
 *
 * `vague` arrived later than the other two and is a different kind of thing: it
 * is not a judgement about what somebody wanted, it is a judgement about
 * whether anybody can act on the sentence. "AI工作流" is a real question from
 * somebody who really wants an answer — it just does not say which workflow, so
 * no reader can tell whether they are the right person. Filing that under
 * "想聊的" would put words in their mouth; leaving it at the top of the question
 * list makes the answerable ones harder to find.
 */
export type Lane = "question" | "vague" | "chat";

export type QuestionStatus = "open" | "claimed" | "closed" | "sunk";

/**
 * Three weeks. After that, a question with nobody on it stops being at the top
 * of the board.
 *
 * It is not deleted and it is still searchable — "sunk" is the honest word for
 * what happened, and it is a visible terminal state. A public queue where
 * everything sits in "open" forever reads as "we are listening" for a fortnight
 * and as "nobody is home" after that.
 */
export const SINK_AFTER_DAYS = 21;

/**
 * The two lanes, and why this is sorting rather than filtering.
 *
 * About two thirds of what people write in the sign-up form's "what do you most
 * want to ask" box is not a question — it is "I want to see what everyone is
 * building", "looking for people on the same wavelength", "just observing".
 * Those are true things to want and they are exactly the matchmaking signal the
 * member wall trades in. They are simply not answerable, and mixing them into a
 * list of answerable questions makes the answerable ones harder to find.
 *
 * ⚠️ **This sorts. It never hides.** The two failure directions are not
 * symmetric: wrongly filing a real question costs a real introduction —
 * "想了解税务申报抵扣相关" is a genuine question with no question mark in it —
 * while wrongly filing a social line costs one row in a different list. So the
 * rule below only moves something out of the question lane on positive evidence
 * that it is social, and everything it is unsure about stays answerable.
 *
 * ⚠️ **And it will be wrong.** The real mechanism is the button in /admin that
 * moves one across; a heuristic that runs on twenty sentences a week is a
 * starting position, not a classifier. Do not grow this into a model.
 */
const ASKING = [
  "？", "?", "怎么", "如何", "为什么", "为何", "能不能", "可不可以", "有没有",
  "哪儿", "哪里", "什么时候", "多少", "是不是", "该不该", "求", "想请问", "想问",
  "想知道", "求助", "卡在", "怎样",
];

const SOCIAL = [
  "看看", "学习", "交流", "认识", "同频", "观察", "了解一下", "随便聊", "见见",
  "拓展人脉", "取取经", "潜水", "凑热闹", "感受一下",
];

export function classifyLane(text: string): Lane {
  const value = text.trim();
  if (!value) return "chat";

  // Anything shaped like a question stays a question, whatever else is in it.
  if (ASKING.some((marker) => value.includes(marker))) return "question";
  if (SOCIAL.some((marker) => value.includes(marker))) return "chat";

  return "question";
}

export type QuestionShape = {
  closed_at: string | null;
  created_at: string;
  /** How many people have said they will be at a session to answer it. */
  claims: number;
  /** How many have written an answer on the site. */
  answers: number;
};

/**
 * The state of a question, derived rather than stored.
 *
 * Only one of the four is a fact somebody entered — `closed_at`, which the
 * asker sets. The other three fall out of what is attached and how old it is,
 * and deriving them is what stops a stored `status` column drifting away from
 * the rows it is supposed to summarise.
 */
export function statusOf(question: QuestionShape, now: Date): QuestionStatus {
  if (question.closed_at) return "closed";
  if (question.claims > 0 || question.answers > 0) return "claimed";

  const age = (now.getTime() - Date.parse(question.created_at)) / 86_400_000;

  return age >= SINK_AFTER_DAYS ? "sunk" : "open";
}

/**
 * Whether somebody may still say "I will be there for this one".
 *
 * A claim names a specific session, and a claim on a session that has already
 * happened is a promise that cannot be kept. The board offers it only for
 * Thursdays that are still ahead.
 */
export function canClaim(status: QuestionStatus): boolean {
  return status !== "closed";
}

/**
 * Whether the author may still change the words.
 *
 * ★ **Only while nothing hangs off it.** The moment somebody claims or answers,
 * the sentence stops being only the asker's: an answer written for "怎么做增长"
 * would silently end up under "怎么给澳洲会计所卖 SaaS" if the asker rewrote it,
 * and the person who spent ten minutes on that answer would never know their
 * words had been repurposed. That is the harm the immutability note at the top
 * of this file is about, and it is a harm to somebody else, which is why it
 * outranks the asker's convenience.
 *
 * `sunk` stays editable on purpose. Nothing is attached to it either, and
 * rewriting a question nobody picked up is exactly the right response to
 * nobody picking it up.
 */
export function canEdit(status: QuestionStatus): boolean {
  return status === "open" || status === "sunk";
}

/**
 * Ordering for one lane of the board.
 *
 * Newest first inside a session, and questions with somebody on them are NOT
 * floated to the top: an answered question is the least urgent thing on the
 * page, and a board that sorts by activity teaches people to answer whatever is
 * already popular.
 */
export function byNewest<T extends { created_at: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
