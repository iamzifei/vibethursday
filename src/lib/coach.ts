/**
 * One follow-up question, asked back at somebody who is still drafting theirs.
 *
 * The board has a real problem this is aimed at: roughly two thirds of what
 * arrives is too general to act on. "怎么做增长" cannot be claimed by anybody,
 * because nobody knows whether they are the right person for it. The specific
 * ones get picked up; the vague ones sink after three weeks.
 *
 * ★ **This never rewrites and never blocks.** It returns one short question and
 * nothing else, and the person edits their own sentence — or ignores it and
 * posts what they had. Two reasons, and the second is the important one:
 *
 *   1. A rewritten question is no longer in the asker's voice, and this board's
 *      whole claim is that the sentences on it are what people actually wrote.
 *      /wharf says so out loud: "问题都是本人写的，原样放在这儿，一个字没改".
 *   2. A gate that rejects a question teaches people to stop asking. The cost of
 *      a vague question is one row nobody claims. The cost of a rejected one is
 *      a person who does not come back to the form.
 *
 * So the failure mode is deliberately "nothing happens". Every error path below
 * returns null, and the button that calls this is opt-in.
 *
 * ⚠️ **This is the only third party any visitor's writing reaches.** The site
 * has no analytics, no fonts from a CDN, no embeds. A draft sent here leaves the
 * server, so the box that calls it says so in the copy — that disclosure is part
 * of the feature, not decoration around it.
 */

/** OpenAI-shaped, which is why there is no SDK here: one POST and one field. */
const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

/** Longer than this and the person has already gone back to typing. */
const TIMEOUT_MS = 8_000;

/** A follow-up question, not a paragraph. Anything longer is a rewrite. */
const MAX_HINT = 80;

/** What the model says when the draft is already specific enough to leave alone. */
const ENOUGH = "OK";

/**
 * Whether the feature exists at all in this deployment.
 *
 * The page calls this and hides the button when it is false, so the site runs
 * unchanged with no key set — which is what local development and any fork of
 * this repo will have.
 */
export function coachAvailable(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

/**
 * The instruction. Worth reading before changing anything here.
 *
 * It is written to make the model's *easiest* output the right one. The single
 * hardest thing to stop a model doing is helpfully answering the question, so
 * that is forbidden first, in the same breath as rewriting; the examples then
 * show the two shapes that matter — one draft that needs a question back, and
 * two that need to be left alone.
 *
 * Both a social line ("想认识做 AI 的人") and an already-sharp question return
 * ENOUGH. The first is not a defect: the board has a whole lane for wanting to
 * meet people, and pushing somebody to make that "more specific" would be
 * arguing with a perfectly good reason to come.
 */
const SYSTEM = [
  "你在帮一个悉尼线下 AI 聚会的参加者打磨他要挂到问题板上的一句话。",
  "别人会看这句话，决定要不要当天找他聊十分钟。",
  "",
  "规则：",
  "- 只输出一句反问，问他漏掉的那个最关键的信息。不超过 30 个字。",
  "- 不要改写他的句子，不要回答他的问题，不要给建议，不要评价，不要解释你在做什么。",
  "- 如果这句已经具体到别人能判断自己接不接得上，只输出 " + ENOUGH + "。",
  "- 如果他写的是想认识什么人、想看看大家在做什么，那不是问题，直接输出 " + ENOUGH + "。",
  // ⚠️ 这一条实测会被忽略，所以下面必须留一个英文例子把它钉住 —— 只写规则时，
  //    英文草稿拿回来的是中文追问。房间里说中文，但站点有英文版，写英文的人
  //    收到一句中文追问就等于这个按钮对他不存在。
  "- 用他写的那种语言回。他用英文写，就用英文回。不要用感叹号。",
  "",
  "例子：",
  "「怎么做增长」→ 你在推的是什么东西，现在卡在哪一步",
  "「想认识做 AI 的人」→ " + ENOUGH,
  "「做完的 app 只有自然量，第一批付费用户从哪儿找」→ " + ENOUGH,
  "「How do I get my first users?」→ What have you built, and who have you shown it to so far",
].join("\n");

/**
 * Turns whatever came back into either a follow-up question or nothing.
 *
 * Split out from the request so it can be tested without a key and without the
 * network. The two things it handles are both observed behaviour rather than
 * hypotheticals: the model wraps a one-liner in quotes about as often as not,
 * and it sometimes writes the leave-it-alone token with punctuation attached.
 */
export function readHint(raw: string): string | null {
  const hint = raw.trim().replace(/^[「"'`\s]+|[」"'`\s。]+$/g, "");

  if (!hint || hint.toUpperCase() === ENOUGH) return null;

  return hint.slice(0, MAX_HINT);
}

/**
 * Asks for one follow-up question. Returns null when there is nothing to say —
 * and also when anything at all goes wrong.
 */
export async function coachQuestion(draft: string): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  // AbortSignal.timeout rather than a manual controller: the request is fire
  // and forget from the caller's point of view, and a hung socket here would
  // otherwise hold a Next.js request open for the platform's full timeout.
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        // Low but not zero. The same vague draft twice in a row should be
        // allowed to surface a different missing piece the second time.
        temperature: 0.3,
        max_tokens: 60,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: draft },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[coach] upstream said", response.status);
      return null;
    }

    const payload = await response.json();
    const raw: unknown = payload?.choices?.[0]?.message?.content;

    return typeof raw === "string" ? readHint(raw) : null;
  } catch (error) {
    // Timeout, DNS, a malformed body — all the same outcome to the person
    // typing, which is that the button did nothing.
    console.error("[coach] could not reach the model", error);
    return null;
  }
}
