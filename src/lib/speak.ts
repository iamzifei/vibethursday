/**
 * /speak — a picked speaker hands in their talk before Thursday.
 *
 * The organiser picks who opens a morning on /admin (`session_shares`). Each
 * pick gets a link: four short answers about the one job they handed to AI,
 * their slides (which become that morning's phone-follow room, so nothing on
 * the day depends on the venue's TV), and an optional AI read of the whole
 * thing against a fixed rubric.
 *
 * ★ **The AI read never decides anything.** It returns two possible verdicts
 * and a one-line fix per item; the organiser still decides who speaks, and the
 * speaker can ignore every word of it. Nothing on this page is gated on it.
 *
 * Everything here is pure (no database, no network, no imports) so it can be
 * tested, and read by the page's client component. The link itself is in
 * speak-token.ts, which needs node:crypto.
 */

/* ── The four answers ─────────────────────────────────────────────────── */

/**
 * The four questions every speaker answers, in the order they are asked:
 * how it was done before, the real numbers since AI took that step, what was
 * tried and did not work, and whether someone in the same trade could copy it.
 */
export const BRIEF_FIELDS = ["before", "numbers", "failed", "copyable"] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];
export type Brief = Record<BriefField, string>;

/** Per answer. A paragraph, not an essay; the talk is the long version. */
export const MAX_BRIEF_FIELD = 1000;

/** The answers out of an untrusted body: strings only, trimmed and bounded. */
export function readBrief(raw: unknown): Brief | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;

  const brief = {} as Brief;
  for (const field of BRIEF_FIELDS) {
    const value = source[field];
    if (value !== undefined && typeof value !== "string") return null;
    brief[field] = (value ?? "").trim().slice(0, MAX_BRIEF_FIELD);
  }
  return brief;
}

/** Whether anything at all has been written. An empty brief is not "handed in". */
export function briefStarted(brief: Brief | null | undefined): boolean {
  return !!brief && BRIEF_FIELDS.some((field) => brief[field].length > 0);
}

/* ── Slide text ───────────────────────────────────────────────────────── */

/** Per page, after whitespace is collapsed. A slide with more is a document. */
export const MAX_SLIDE_TEXT = 2000;

/**
 * Text read out of one PDF page in the browser, made safe to store. Empty for
 * an image upload or a page that is only a picture.
 */
export function normaliseSlideText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // NUL is the one character Postgres text refuses outright.
  return raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_SLIDE_TEXT);
}

/* ── The AI read ──────────────────────────────────────────────────────── */

/**
 * The rubric, one key per line of it:
 *  - theme: on this week's theme, and says which step went to AI and what it saved
 *  - questions: all four answered, with the speaker's own numbers
 *  - pitch: no sales pitch (prices, "come and work with me")
 *  - conflict: nothing that pulls people to another group or sells against
 *    the community's own courses
 *  - plain: a business owner who is not technical can follow it
 */
export const REVIEW_ITEMS = ["theme", "questions", "pitch", "conflict", "plain"] as const;
export type ReviewItemKey = (typeof REVIEW_ITEMS)[number];

/** The only two verdicts there are. Stored as written; the page translates. */
export const VERDICT_OK = "可以讲";
export const VERDICT_FIX = "建议改一改";
export type Verdict = typeof VERDICT_OK | typeof VERDICT_FIX;

export type ReviewItem = { ok: boolean; fix: string };
export type Review = {
  verdict: Verdict;
  items: Record<ReviewItemKey, ReviewItem>;
};

const MAX_FIX = 160;

/**
 * The model's answer, or null if it broke the contract.
 *
 * Every rubric line must be there with a boolean; a missing one is not filled
 * in with a guess, because "the AI said this was fine" must only ever mean it
 * did. The verdict follows the items: any line marked not ok makes it
 * 建议改一改, whatever the model wrote at the top — a review whose own lines
 * disagree with its conclusion is the one a speaker cannot act on.
 */
export function readReview(raw: string): Review | null {
  let parsed: unknown;
  try {
    // JSON mode is requested, but a model that ignores it usually wraps the
    // object in a fenced block rather than abandoning it.
    const object = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(object ? object[0] : raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const source = (parsed as { items?: unknown }).items;
  if (!source || typeof source !== "object") return null;

  const items = {} as Record<ReviewItemKey, ReviewItem>;
  for (const key of REVIEW_ITEMS) {
    const item = (source as Record<string, unknown>)[key];
    if (!item || typeof item !== "object") return null;
    const { ok, fix } = item as { ok?: unknown; fix?: unknown };
    if (typeof ok !== "boolean") return null;
    items[key] = { ok, fix: typeof fix === "string" ? fix.trim().slice(0, MAX_FIX) : "" };
  }

  const said = (parsed as { verdict?: unknown }).verdict;
  const allOk = REVIEW_ITEMS.every((key) => items[key].ok);
  const verdict: Verdict = !allOk ? VERDICT_FIX : said === VERDICT_FIX ? VERDICT_FIX : VERDICT_OK;

  return { verdict, items };
}

/** A stored review read back from the database, where it is plain JSON. */
export function storedReview(value: unknown): Review | null {
  return value && typeof value === "object" ? readReview(JSON.stringify(value)) : null;
}

/** Most of the deck's text sent with one review; the rest is cut, not summarised. */
export const MAX_REVIEW_SLIDE_TEXT = 8000;

/**
 * The instruction. Fixed on purpose: the same draft should get the same read,
 * so the rubric is written out rather than left to the model's taste.
 */
export const REVIEW_SYSTEM = `你在帮一个线下 AI 聚会的主持人预审分享者的稿子。听众主要是做生意的老板，不是程序员。
每场有一个「本周主题」，分享者讲自己那一行里「哪一步交给了 AI、省了多少」。

按下面五条逐条判断，每条给 ok（true/false）和一句改法 fix（不超过 40 个字，写给分享者本人看，直接说怎么改；ok 为 true 时 fix 可以留空）：
1. theme：讲的是不是本周主题；有没有说清「哪一步交给了 AI、省了多少」。没有给本周主题时，只看后半句。
2. questions：四问是否都答了（以前怎么做 / 交给 AI 后的真数字 / 试过不行的 / 同行能不能照抄），数字是不是分享者自己的真实数字，而不是行业报告或估算。
3. pitch：有没有推销：报价、招揽客户、「欢迎找我合作」「扫码加我」。想合作应该散场后私聊，台上只讲案例。
4. conflict：有没有和社群或社群课程冲突的内容：把人拉去别的群或别的课，或者卖和本社群课程直接竞争的东西。
5. plain：老板听不听得懂：黑话、缩写、纯技术细节太多就是 false（技术细节适合周二线上，不适合周四）。

verdict 只能是「可以讲」或「建议改一改」两个之一：五条都 ok 才是「可以讲」。
fix 用分享者回答所用的语言写。只评内容，不评文笔。不要编造稿子里没有的东西。
只输出 JSON，格式：{"verdict":"可以讲","items":{"theme":{"ok":true,"fix":""},"questions":{"ok":true,"fix":""},"pitch":{"ok":true,"fix":""},"conflict":{"ok":true,"fix":""},"plain":{"ok":true,"fix":""}}}`;

const QUESTION_LABEL: Record<BriefField, string> = {
  before: "以前怎么做",
  numbers: "交给 AI 后的真数字",
  failed: "试过不行的",
  copyable: "同行能不能照抄",
};

/** What the model is shown: theme, the four answers, and whatever text the slides had. */
export function buildReviewInput(input: { theme: string | null; brief: Brief; slideText: readonly string[] }): string {
  const lines = [`本周主题：${input.theme?.trim() || "（还没定）"}`, "", "四问："];
  for (const field of BRIEF_FIELDS) lines.push(`【${QUESTION_LABEL[field]}】${input.brief[field] || "（没写）"}`);

  const pages = input.slideText.map((text, idx) => (text ? `第 ${idx + 1} 页：${text}` : "")).filter(Boolean);
  lines.push("", "幻灯片文字：");
  if (pages.length === 0) {
    lines.push("（没有可读的文字：没传幻灯片，或者幻灯片是截图。只按四问判断，不要因此扣分。）");
  } else {
    lines.push(pages.join("\n").slice(0, MAX_REVIEW_SLIDE_TEXT));
  }
  return lines.join("\n");
}

/* ── How many reads ───────────────────────────────────────────────────── */

/** Per speaker per morning. Enough to read, fix and read again a few times. */
export const SPEAKER_REVIEW_LIMIT = 10;

/**
 * One speaker's allowance, counted on their own `session_shares` row.
 *
 * ★ The `review_count < $3` is the cap, for the same reason as the daily one
 * in coach-budget.ts: without it the statement still runs and still counts,
 * and simply never refuses. One statement, so two presses at once cannot both
 * read nine and both go ahead.
 */
export const SPEAKER_REVIEW_SQL = `UPDATE session_shares SET review_count = review_count + 1
     WHERE session = $1::date AND signup_id = $2::bigint AND review_count < $3
     RETURNING review_count`;

export type CapQuery = (sql: string, params: unknown[]) => Promise<{ rowCount: number | null }>;

/** Takes one read out of this speaker's allowance. False when it is used up. */
export async function spendSpeakerReview(
  query: CapQuery,
  session: string,
  signupId: string,
  limit: number = SPEAKER_REVIEW_LIMIT,
): Promise<boolean> {
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const result = await query(SPEAKER_REVIEW_SQL, [session, signupId, limit]);
  return result.rowCount === 1;
}
