/**
 * What the venue screen (/screen) shows on a Thursday: the morning in order,
 * as announced in the group on 2026-10-21 — members open with 10-minute
 * shares, then Q&A, and the introductions move to the dinner.
 * Kept here, not in the page, so a test can hold the times in order.
 */
export const SCREEN_SCHEDULE: { time: string; title: string; note: string }[] = [
  { time: "10:30", title: "开门 · 签到 · 点饮品", note: "到门口扫码签到，在吧台报名字点单" },
  { time: "10:45", title: "开场分享", note: "2–3 位朋友，每人 10 分钟：在做什么、怎么用 AI" },
  { time: "11:20", title: "Q&A", note: "带着具体问题来，大家一起出主意" },
  { time: "12:00", title: "结束 · 散场聚餐", note: "留下吃午饭：每人 2 分钟自我介绍 + 5 分钟问答" },
];

/** Where the two codes on the screen lead, relative to the site's origin. */
export const SCREEN_LINKS = {
  signup: "/#signup",
  dinner: "/my",
} as const;
