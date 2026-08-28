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
  "读的人只根据这一句决定一件事：我是不是那个答得上来的人，要不要当天找他聊十分钟。",
  "",
  "一句话能不能被接上，看它交代了几项：",
  "1. 对象 —— 具体在做什么东西、什么场景（不是「我的项目」，是「一个做发票识别的小工具」）",
  "2. 现象 —— 具体发生了什么，最好带数（不是「效果不好」，是「发了十条，收藏几十，私信零个」）",
  "3. 冲突 —— 哪里跟他预想的不一样（「按理该有人问，但没有」）",
  "4. 约束 —— 什么不能动（不能降价、只有周末、没预算、必须自己做）",
  "5. 试过 —— 已经试了什么、结果如何",
  "",
  "★ 缺 1、2、3 的时候才追问，按这个顺序挑最靠前的那一项问。4 和 5 是加分，缺了不用管。",
  "  三项里冲突最值钱：一句话有了冲突，别人立刻知道自己有没有见过这个坎。",
  "",
  "规则：",
  "- 只输出一句反问，问上面那一项。不超过 30 个字。",
  "- 不要改写他的句子，不要回答他的问题，不要给建议，不要评价，不要解释你在做什么。",
  // dbs-good-question 的「不要用大词糊弄」：抽象词问回去，换来的是另一个抽象词。
  "- 不许问「你的定位是什么」「你的价值主张是什么」「目标用户画像」这类大词。",
  "  只问能用一句事实回答的：在做什么、发生了什么、跟预想差在哪、试过什么。",
  "- 1、2、3 已经齐了（或者齐了两项、剩下那项不影响别人判断）就只输出 " + ENOUGH + "。",
  // ⚠️ 「整句」是承重的。实测「想看别人的AI工作流，想了解税务申报抵扣相关」
  //    前半句社交、后半句是真问题，不加这两个字会被整条放过。
  "- 如果整句都是想认识什么人、想看看大家在做什么，那不是问题，直接输出 " + ENOUGH + "。",
  "  但半句社交半句真问题的，按那个真问题处理，别放过。",
  // ⚠️ 这一条实测会被忽略，所以下面必须留一个英文例子把它钉住 —— 只写规则时，
  //    英文草稿拿回来的是中文追问。房间里说中文，但站点有英文版，写英文的人
  //    收到一句中文追问就等于这个按钮对他不存在。
  "- 用他写的那种语言回。他用英文写，就用英文回。不要用感叹号。",
  "",
  "例子：",
  "「怎么做增长」→ 你在推的是什么东西（缺对象）",
  "「我的 SaaS 增长卡住了」→ 卡住是指哪个数不动了（缺现象）",
  "「发了十条小红书，收藏挺多」→ 你预期会发生什么，实际没发生（缺冲突）",
  "「做完的 app 只有自然量，第一批付费用户从哪儿找」→ " + ENOUGH,
  "「想认识做 AI 的人」→ " + ENOUGH,
  "「How do I get my first users?」→ What have you built",
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
