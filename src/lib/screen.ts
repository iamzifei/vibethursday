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

/** Where the two codes on the screen lead, relative to the site's origin. */
export const SCREEN_LINKS = {
  signup: "/#signup",
  member: "/vip",
} as const;

/** The membership slide: the same items, values and price as /vip. */
export const SCREEN_MEMBER = {
  price: "599 澳元 + GST",
  points: [
    "4 小时实战课：手把手从智能体到官网搭建",
    "12 个月在线社群，每周行业洞察与案例分享",
    "全年超 30 次周二 Workshop，会员免费",
    "部分好想法免费搭建，收益共享",
    "加赠 AI自媒体+IP实战课；前 15 名送一页式官网",
  ],
};
