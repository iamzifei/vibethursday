// Relative imports only: the tests load this through Node's type stripper.

/**
 * The class workbook (2026-10-24): the pages under /class/ that replace pen and
 * paper on the day of the paid class.
 *
 * Four forms, two kinds of ending:
 *
 * - The business profile and the industry pack become a Markdown file the
 *   person downloads (or copies) and drags into the AI platform used in class.
 *   They are never sent here: they are the details of somebody's business, and
 *   the platform is where they need to go, not this site.
 * - The card and the spec are handed in, so the organiser can read them during
 *   and after the class. Those two are what `parseKitSubmission` accepts.
 *
 * Everything a person types is also kept in their own browser (localStorage)
 * by the form component, so a reload or a closed tab loses nothing.
 */

export type KitField = {
  /** Form name, also the localStorage key suffix and the CSV column. */
  name: string;
  label: string;
  /** Shown under the label. */
  hint?: string;
  placeholder?: string;
  /** "line": one line. "text": a few lines. "long": a whole document. "choice": pick one of `options`. */
  type: "line" | "text" | "long" | "choice";
  options?: readonly string[];
  /** Longest accepted value, in characters. */
  max: number;
  required?: boolean;
};

export type KitKind = "card" | "profile" | "pack" | "spec";

/** The two forms that are handed in; the other two never leave the browser. */
export const SUBMITTED_KINDS = ["card", "spec"] as const;
export type SubmittedKind = (typeof SUBMITTED_KINDS)[number];

export const AREAS = ["运营", "客服", "获客", "内容"] as const;

export const CARD_FIELDS: readonly KitField[] = [
  { name: "biz", label: "你做什么生意", hint: "一句话", placeholder: "比如：Hurstville 做贷款", type: "line", max: 200, required: true },
  { name: "pain", label: "现在最头疼的一件事", hint: "写一件具体的、能看见的事，不写「想多赚钱」", placeholder: "比如：回家长消息回到晚上十点", type: "text", max: 500, required: true },
  { name: "area", label: "这件事属于哪一类", type: "choice", options: AREAS, max: 10 },
];

/** The 13 boxes, worded as in the sample profile shown in class. */
export const PROFILE_FIELDS: readonly KitField[] = [
  { name: "p1", label: "1 一句话生意", placeholder: "在哪一带、做什么", type: "line", max: 300, required: true },
  { name: "p2", label: "2 地址 / 服务区域", placeholder: "比如：Eastwood 及周边", type: "line", max: 300 },
  { name: "p3", label: "3 主要服务与价格", hint: "写价格区间，写清含不含 GST", type: "text", max: 1500 },
  { name: "p4", label: "4 典型客人", placeholder: "多大年纪、什么情况下来找你", type: "text", max: 800 },
  { name: "p5", label: "5 客人从哪来", placeholder: "小红书、朋友介绍、Google……大概各占多少", type: "text", max: 800 },
  { name: "p6", label: "6 客人最常问的三个问题", type: "text", max: 800 },
  { name: "p7", label: "7 一单的流程", placeholder: "从客人留言到收尾款，一步一步写", type: "text", max: 1200 },
  { name: "p8", label: "8 人手与分工", type: "text", max: 800 },
  { name: "p9", label: "9 在用的渠道", type: "line", max: 300 },
  { name: "p10", label: "10 营业时间", type: "line", max: 300 },
  { name: "p11", label: "11 现在最头疼的一件事", type: "text", max: 800 },
  { name: "p12", label: "12 这件事每周花多少时间", type: "line", max: 300 },
  { name: "p13", label: "13 不让 AI 碰的事", hint: "最重要的一格：这就是你自己的规矩", placeholder: "比如：报价、折扣、退款，必须我本人定", type: "text", max: 800, required: true },
];

export const PACK_FIELDS: readonly KitField[] = [
  { name: "industry", label: "你这一行", placeholder: "比如：装修、留学、贷款", type: "line", max: 100, required: true },
  { name: "e1", label: "行业经验 1", hint: "客人怎么挑、什么时候最忙、最常卡在哪一步、同行在做什么", type: "text", max: 600, required: true },
  { name: "e2", label: "行业经验 2", type: "text", max: 600 },
  { name: "e3", label: "行业经验 3", type: "text", max: 600 },
  { name: "e4", label: "行业经验 4", type: "text", max: 600 },
  { name: "e5", label: "行业经验 5", type: "text", max: 600 },
  { name: "rule", label: "一条最新规定", hint: "从官方网站拷原文，不要凭记忆写", type: "text", max: 2000 },
  { name: "ruleSource", label: "规定的出处（网址）", type: "line", max: 300 },
  { name: "ruleDate", label: "规定的日期", placeholder: "比如：2026-10-24 查的", type: "line", max: 60 },
];

export const SPEC_FIELDS: readonly KitField[] = [
  { name: "thing", label: "你最想交给 AI 的一件事", hint: "可以是早上卡片上那件，也可以是新的", type: "text", max: 800, required: true },
  { name: "spec", label: "把平台给你的需求说明书贴在这里", hint: "整段复制过来；还没写完也可以先交", type: "long", max: 20000 },
  { name: "name", label: "称呼", hint: "选填。想让我们跟进，就留称呼和微信", type: "line", max: 100 },
  { name: "wechat", label: "微信号", hint: "选填", type: "line", max: 100 },
];

export const KIT_FIELDS: Record<KitKind, readonly KitField[]> = {
  card: CARD_FIELDS,
  profile: PROFILE_FIELDS,
  pack: PACK_FIELDS,
  spec: SPEC_FIELDS,
};

export type KitValues = Record<string, string>;

/** "  a\n  b" for a value that runs over several lines, so a numbered box stays readable. */
function indentContinuation(value: string): string {
  return value.trim().replace(/\r\n?/g, "\n").replace(/\n/g, "\n   ");
}

/** The business profile as the Markdown file that goes into the platform. Empty boxes are left out. */
export function profileMarkdown(values: KitValues, today: string): string {
  const lines = [`【业务档案】（更新日期：${today}）`, ""];
  for (const field of PROFILE_FIELDS) {
    const value = (values[field.name] ?? "").trim();
    if (!value) continue;
    // "1 一句话生意" → "1 一句话生意：…", the same shape as the sample shown in class.
    lines.push(`${field.label}：${indentContinuation(value)}`);
  }
  return `${lines.join("\n")}\n`;
}

/** The industry pack as a Markdown file: experience first, then the dated rule. */
export function packMarkdown(values: KitValues, today: string): string {
  const get = (name: string) => (values[name] ?? "").trim();
  const industry = get("industry") || "我的行业";
  const lines = [`【行业知识包：${industry}】（整理日期：${today}。经验部分是我自己的行业经验和洞见；规定部分以官方最新原文为准）`, ""];

  const experience = ["e1", "e2", "e3", "e4", "e5"].map(get).filter(Boolean);
  if (experience.length) {
    lines.push("一、这一行的行业经验");
    experience.forEach((item, index) => lines.push(`${index + 1}. ${indentContinuation(item)}`));
    lines.push("");
  }

  if (get("rule")) {
    lines.push("二、最新规定（以官方原文为准）");
    lines.push(`- 规定：${indentContinuation(get("rule"))}`);
    if (get("ruleSource")) lines.push(`- 出处：${get("ruleSource")}`);
    if (get("ruleDate")) lines.push(`- 日期：${get("ruleDate")}`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/** The card as three plain lines, for pasting into the platform as the first question. */
export function cardText(values: KitValues): string {
  const get = (name: string) => (values[name] ?? "").trim();
  return [
    get("biz") && `我的生意：${get("biz")}`,
    get("pain") && `最头疼的一件事：${get("pain")}`,
    get("area") && `属于：${get("area")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type KitSubmission = {
  kind: SubmittedKind;
  /** Only the known fields of that kind, trimmed and capped. */
  payload: KitValues;
  name: string | null;
  wechat: string | null;
};

export function isSubmittedKind(value: unknown): value is SubmittedKind {
  return typeof value === "string" && (SUBMITTED_KINDS as readonly string[]).includes(value);
}

/**
 * Reads a handed-in form. Returns null when it is not one of the two kinds that
 * are handed in, or when a required box is empty.
 *
 * Unknown keys are dropped and every value is capped at its field's `max`: the
 * body is a POST from a browser, and anything one curl away is not trusted. A
 * "choice" outside its options is treated as skipped.
 */
export function parseKitSubmission(kind: unknown, raw: unknown): KitSubmission | null {
  if (!isSubmittedKind(kind)) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;

  const payload: KitValues = {};
  for (const field of KIT_FIELDS[kind]) {
    const value = source[field.name];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, field.max);
    if (!trimmed) continue;
    if (field.type === "choice" && !(field.options ?? []).includes(trimmed)) continue;
    payload[field.name] = trimmed;
  }

  if (KIT_FIELDS[kind].some((field) => field.required && !payload[field.name])) return null;

  // Name and WeChat sit in their own columns so the export can be sorted by
  // them; they stay in the payload too, which is what the page saved.
  return { kind, payload, name: payload.name ?? null, wechat: payload.wechat ?? null };
}

/** Columns of the organiser's CSV export, after kind / name / wechat / created_at. */
export const KIT_EXPORT_FIELDS = ["biz", "pain", "area", "thing", "spec"] as const;
