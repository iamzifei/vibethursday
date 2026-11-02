/**
 * What the venue screen (/screen) shows on a Thursday: the morning in order,
 * as announced in the group on 2026-10-21 — members open with 10-minute
 * shares, then Q&A, and the introductions move to the dinner.
 * Kept here, not in the page, so a test can hold the times in order.
 */
export const SCREEN_SCHEDULE: { time: string; title: string; note: string }[] = [
  { time: "10:30", title: "开门 · 签到", note: "到门口扫码签到，到吧台点一份喝的或吃的" },
  { time: "10:45", title: "开场分享", note: "2–3 位朋友，每人 10 分钟：在做什么、怎么用 AI" },
  { time: "11:20", title: "Q&A", note: "带着具体问题来，大家一起出主意" },
  { time: "12:00", title: "结束", note: "想接着聊的可以留下吃午饭，现场点单" },
];

/** Where the codes on the screen lead, relative to the site's origin. */
export const SCREEN_LINKS = {
  checkin: "/go",
  signup: "/#signup",
  tuesday: "/tuesday",
  join: "/join",
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
  price: "30 澳元 + GST · 共创会员和导师团免费",
  points: [
    "上午｜按自己的节奏推进项目，导师团陪跑",
    "中午｜边吃边聊老板的需求",
    "下午｜workshop，当场动手做",
    "适合在做东西的人，也欢迎带着真实需求的老板",
  ],
};

/**
 * What the screen shows on each kind of day (2026-11-02): on a Thursday the
 * morning plus a slide pointing on to Tuesday; on a Build Tuesday that day's
 * three parts plus the 共创会员, which is where a Tuesday closes.
 */
export type ScreenDay = {
  eyebrow: string;
  title: string;
  lead: string;
  schedule: { time: string; title: string; note: string }[];
  signupCaption: string;
  second: { eyebrow: string; title: string; price: string; points: string[]; href: string; caption: string };
};

export function screenFor(tuesday: boolean): ScreenDay {
  if (!tuesday) {
    return {
      eyebrow: "§ Vibe Thursday · 疯狂星期四",
      title: "一群用 AI 做事的人，每周四聚一次。",
      lead: "这不是课，没有系统教学。手上有东西就打开给大家看，做了一半也行；卡住了，现场问。",
      schedule: SCREEN_SCHEDULE,
      signupCaption: "每周四免费 · 下周也能报",
      second: { eyebrow: SCREEN_TUESDAY.when, title: SCREEN_TUESDAY.title, price: SCREEN_TUESDAY.price, points: SCREEN_TUESDAY.points, href: SCREEN_LINKS.tuesday, caption: "扫码报周二 · vibethursday.com/tuesday" },
    };
  }
  return {
    eyebrow: "§ Build Tuesday · 周二动手局",
    title: "今天周二：上午专注推进，下午动手做。",
    lead: "按自己的节奏推进手上的项目，导师团和共建者在旁边陪跑，不讲课。卡住了随时问。",
    schedule: [
      { time: "10:30", title: "专注推进", note: "先扫码签到；每人推进自己的项目，会技术的一起拆" },
      { time: "12:00", title: "午饭聊需求", note: "各自点餐，边吃边聊老板的需求" },
      { time: "13:30", title: "workshop", note: "当场动手；备考 AWS AI 证书的一起做题" },
    ],
    signupCaption: "下周二也能报 · 12 人闭门",
    second: {
      eyebrow: "共创会员 · 599 澳元 + GST 一年",
      title: "常来周二，办共创会员",
      price: "一年内每周二免门票",
      points: ["再送一次澳洲 AI+IP 实战课", "名片上有「共创会员」标", "刷卡付款，付完马上生效"],
      href: SCREEN_LINKS.join,
      caption: "扫码了解 · vibethursday.com/join",
    },
  };
}
