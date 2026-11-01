/**
 * What the venue screen (/screen) shows on a Thursday: the morning in order,
 * as announced in the group on 2026-10-21 — members open with 10-minute
 * shares, then Q&A, and the introductions move to the dinner.
 * Kept here, not in the page, so a test can hold the times in order.
 */
export const SCREEN_SCHEDULE: { time: string; title: string; note: string }[] = [
  { time: "10:30", title: "开门 · 签到 · 点饮品", note: "到门口扫码签到，在吧台点单付款" },
  { time: "10:45", title: "开场分享", note: "2–3 位朋友，每人 10 分钟：在做什么、怎么用 AI" },
  { time: "11:20", title: "Q&A", note: "带着具体问题来，大家一起出主意" },
  { time: "12:00", title: "结束", note: "想接着聊的可以留下吃午饭，现场点单" },
];

/** Where the codes on the screen lead, relative to the site's origin. */
export const SCREEN_LINKS = {
  checkin: "/go",
  signup: "/#signup",
  member: "/vip",
} as const;

/**
 * The class slide: the same class, price and items as /vip (2026-11-01, the
 * AI+IP class; until then the $599 membership, no longer on sale).
 */
export const SCREEN_CLASS = {
  title: "澳洲 AI+IP 实战课",
  when: "11 月 15 日（周日）9:00–15:00 · St Leonards",
  price: "365 澳元 + GST",
  points: [
    "Nick｜商业 IP 定位",
    "Lankey｜IP 打造",
    "特邀嘉宾｜实战分享",
    "James｜AI 应用",
    "含一年复训：全年不少于 6 次；共创会员免费",
  ],
};
