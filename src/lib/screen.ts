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
  tuesday: "/tuesday",
} as const;

/**
 * The second slide: Build Tuesday (2026-11-02). Thursday sells nothing — it
 * is free and points people on (James 2026-11-02).
 * Until then this slide sold the class, which made a free morning look like a
 * sales pitch. People who build things are sent to Tuesday; the class is on
 * the site for whoever looks for it, not on the screen.
 */
export const SCREEN_TUESDAY = {
  title: "Build Tuesday · 周二动手局",
  when: "每周二 10:30–15:30 · Chatswood · 12 人闭门会",
  price: "30 澳元 + GST · 共创会员免费",
  points: [
    "上午｜带项目的人、会技术的人，聊项目和 AI 技术",
    "中午｜边吃边聊老板的需求",
    "下午｜workshop，当场动手做",
    "适合在做东西的人，也欢迎带着真实需求的老板",
  ],
};
