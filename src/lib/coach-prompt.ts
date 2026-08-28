// Relative, not "@/": the tests and the eval script load this directly.

/**
 * What the ask-box helper is told, and how its answer is read back.
 *
 * ★ **Split out from the request so that the prompt is an artefact with tests
 * and a score, not a string somebody edited by feel.** The first version was
 * exactly that string, and it had three faults that only showed up when the
 * same draft was sent three times:
 *
 *   1. It leaked "（缺对象）" — an annotation from its own examples — into text
 *      that people read.
 *   2. Asked three times, one draft got three different follow-ups from three
 *      different categories. There was no step where it decided what was
 *      missing; it went straight to writing a question, and re-decided silently
 *      every time.
 *   3. It asked "what did you expect to happen that didn't" of somebody whose
 *      draft was "AI 小白、想来学习" — a person who has not built anything yet
 *      and therefore has no result to be surprised by.
 *
 * All three are the same fault. So the model now has to name the gap before it
 * writes anything, in a field of its own. That makes the choice inspectable,
 * makes it gradeable against a fixture set (`npm run coach:eval`), and stops
 * the category-three question being asked of a category-one draft.
 */

/**
 * The gap being filled, in the order it is looked for.
 *
 * From `dbs-good-question`'s five checks, minus the two that do not earn a
 * follow-up here. "Constraints" and "what have you tried" make a question
 * better, but a question missing only those is already answerable, and this
 * button exists to make questions answerable, not perfect.
 */
export const GAPS = ["object", "phenomenon", "conflict", "none", "social"] as const;
export type Gap = (typeof GAPS)[number];

export type Coaching = {
  /** Which gap the model decided to fill. `none`/`social` mean leave it alone. */
  gap: Gap;
  /** The follow-up, empty when the draft is being left alone. */
  ask: string;
};

/** A follow-up question, not a paragraph. Anything longer is a rewrite. */
export const MAX_ASK = 80;

/**
 * The examples.
 *
 * ⚠️ **Every draft here is real, taken off the live board.** Inventing them
 * would tune the prompt against sentences nobody writes: the board's actual
 * failure mode is not "怎么做增长", it is "AI工作流" — two words, no verb.
 *
 * ⚠️ **And they are annotation-free.** The `gap` lives in its own field rather
 * than in a parenthetical after the question, because the first version put it
 * in a parenthetical and the model copied the parenthetical into its answer.
 * A label inside the text is a label the model will reproduce.
 */
export const EXAMPLES: { draft: string; gap: Gap; ask: string }[] = [
  // The commonest shape on the board: a topic, not a question.
  { draft: "AI工作流", gap: "object", ask: "你在跑的是什么工作流，做什么用的" },
  // Has an object, but nothing has happened to it yet.
  { draft: "ai制作书法课程", gap: "phenomenon", ask: "课程做到哪一步了，卡在什么地方" },
  // Object and result, but no surprise — so nobody knows if they have seen it.
  {
    draft: "发了十条小红书，收藏挺多",
    gap: "conflict",
    ask: "你预期收藏之后会发生什么，实际没发生",
  },
  // ★ Already answerable. Somebody reading it knows instantly whether they are
  //   the right person, which is the entire bar.
  {
    draft: "做完的 app 只有自然量，第一批付费用户从哪儿找",
    gap: "none",
    ask: "",
  },
  // ★ Not a question and not meant to be. The board has a lane for this.
  { draft: "想聽聽別人在AI都在做些什麼", gap: "social", ask: "" },
  // ⚠️ The case the first version got wrong. A beginner has no result yet, so
  //    asking what surprised them is asking about something that never happened.
  {
    draft: "AI 小白、想来学习各位大神都怎么开始拥抱AI",
    gap: "object",
    ask: "你手上想用 AI 做的是哪件具体的事",
  },
  // Half social, half a real question. The real half wins.
  {
    draft: "想看别人的AI工作流，想了解税务申报抵扣相关",
    gap: "object",
    ask: "你想问的是哪个国家、哪一类的抵扣",
  },
  // English, so that the language rule has something to imitate rather than
  // only a sentence telling it to. Told-not-shown, it replies in Chinese.
  {
    draft: "How do I get my first users?",
    gap: "object",
    ask: "What have you built",
  },
  // ⚠️ Three of the eight examples are now leave-it-alone, and that ratio is
  //    deliberate. Graded against held-out drafts, the first version scored
  //    15/20 and every single miss was the same one: it found something missing
  //    in a draft that was already fine. A model shown seven gaps and one
  //    "leave it" learns that its job is to find a gap.
  {
    draft: "自己写的定时任务在 Vercel 上偶尔不触发，日志里什么都没有",
    gap: "none",
    ask: "",
  },
  // ★ Two of the three checks, and that is enough. The bar is not "all three",
  //   it is "a reader knows whether they are the right person".
  {
    draft: "想问下大家 Stripe 订阅退款走哪个流程比较省事，我这边是澳洲主体",
    gap: "none",
    ask: "",
  },
  // Wanting to build something with somebody is wanting to meet people.
  { draft: "想找个人一起搞个小项目", gap: "social", ask: "" },
  // ⚠️ A bare topic with no subject. The shape that made the rule above lead
  //    with "what they want is people": one of these came back `social` in
  //    production and the box told its author the sentence was specific
  //    enough. Vague is fixable; wanting company is not, and they are not the
  //    same thing.
  //
  //    (The draft that actually surfaced this lives in the graded set, not
  //    here. Teaching on the failing case and then scoring on it is how a
  //    prompt reaches 100% and learns nothing.)
  { draft: "想聊聊定价这块", gap: "object", ask: "你要定价的是什么东西，卖给谁" },
];

const RULES = `你在帮一个悉尼线下 AI 聚会的参加者打磨他要挂到问题板上的一句话。

读的人只根据这一句决定一件事：我是不是那个答得上来的人，要不要当天找他聊十分钟。
所以合格线不是「问得漂亮」，是「别人扫一眼就知道自己接不接得上」。

★ 默认是不追问。追问要打断一个正在写字的人，所以只有在别人**确实判断不了自己接不接得上**
的时候才值得。合格线不是「三项齐全」，是「够别人做那个判断」——两项往往就够了。
拿不准该不该追问，就判 none。

先判断缺哪一项，按这个顺序找第一个缺的：

- object      —— 缺对象。看不出他在做什么东西、什么场景。
                 「AI工作流」「怎么做增长」都是这一档。
- phenomenon  —— 有对象，但没说发生了什么。看不出他卡在哪、走到哪一步了。
- conflict    —— 有对象也有现象，但没说哪里跟他预想的不一样。
                 ⚠️ 只有当他确实已经做了、并且有结果时才用这一档。
                 一个还没开始做的人（「想来学习」「AI 小白」）没有现象也没有冲突，
                 那是缺 object，不是缺 conflict。问他「预期什么没发生」是在问一件没发生过的事。
- none        —— 够别人判断了，不要追问。
                 只要**有对象 + 有一个具体的坎**就算够，不需要凑满三项。
                 已经带了数字、带了约束、带了「该 A 还是该 B」的，一律 none。
- social      —— ★ 判据是「他要的是人」，不是「他写得泛」。
                 想认识谁、想看看别人在做什么、想找人一起做点东西——目的是人，判 social。
                 ⚠️ **只是话题写得泛，不是 social，是缺 object。**
                 「聊产品，找需求，出主意」「AI工作流」「想聊 AI 怎么帮助自我提升」
                 这些都是话题，只是没说清是哪个产品、哪条工作流、哪件事——那是 object。
                 分界线：**泛，是可以问具体的；要认识人，没什么可问的。**
                 半句社交半句真问题的，按真问题处理。

接着上一轮：

- 这不是一问一答，是同一个人在把一句话磨清楚。上面如果已经有过一轮，
  **先看他这次补了什么**，再判断现在缺哪一项。
- 他补上了 → 判下一项，或者判 none。
- 他没补上、或者补完还是泛 → **换一个更具体的问法去问同一件事，不要把原话再说一遍。**
- ★ **已经问过两轮还没到位，就判 none 放他走。** 追问第三次是在跟人较劲，
  而这个板子宁可挂一句不够好的问题，也不要把一个愿意写的人磨走。

写追问的规则：

- 只写一句反问，就问你判出来的那一项。不超过 30 个字。
- 不要改写他的句子，不要回答他的问题，不要给建议，不要评价。
- 不许问「你的定位是什么」「价值主张」「目标用户画像」这类大词。
  只问能用一句事实回答的：在做什么、发生了什么、跟预想差在哪。
- 用他写的那种语言回。他用英文写，就用英文回。不要用感叹号。
- gap 是 none 或 social 时，ask 留空字符串。`;

/** The output contract. The word "json" has to appear for DeepSeek's JSON mode. */
const FORMAT = `只输出一个 json 对象，两个字段，没有别的：
{"gap": "object|phenomenon|conflict|none|social", "ask": "一句反问，或空字符串"}`;

export function buildSystem(): string {
  const shots = EXAMPLES.map(
    (e) => `草稿：${e.draft}\n输出：${JSON.stringify({ gap: e.gap, ask: e.ask })}`,
  ).join("\n\n");

  return `${RULES}\n\n${FORMAT}\n\n例子：\n\n${shots}`;
}

/**
 * Reads the model's answer back, or returns null if it is not usable.
 *
 * Null is a real outcome rather than an error: the button's whole contract is
 * that a bad moment upstream costs the person nothing, so anything unparseable
 * ends the same way as "your draft is fine" — nothing happens, and posting is
 * unaffected.
 */
export function readCoaching(raw: string): Coaching | null {
  let parsed: unknown;

  try {
    // JSON mode is requested, but a model that ignores it usually wraps the
    // object in a fenced block rather than abandoning it entirely.
    const fenced = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(fenced ? fenced[0] : raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const { gap, ask } = parsed as { gap?: unknown; ask?: unknown };

  // An unknown gap is not coerced to something plausible. If the contract
  // broke, the honest outcome is no advice, not advice filed under a guess.
  if (typeof gap !== "string" || !(GAPS as readonly string[]).includes(gap)) return null;

  const text = typeof ask === "string" ? ask.trim().slice(0, MAX_ASK) : "";

  // The two leave-it-alone verdicts carry no question, whatever the model put
  // in the field.
  if (gap === "none" || gap === "social") return { gap, ask: "" };

  // A gap was named but nothing was asked. Nothing to show, so nothing to say.
  if (!text) return null;

  return { gap: gap as Gap, ask: text };
}
