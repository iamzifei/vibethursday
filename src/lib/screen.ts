/**
 * What the venue screen (/screen) shows on a Thursday: the morning in order.
 * Since 2026-11-08 it matches the home page's coarse run of show — one line
 * each on your line of work, then real uses industry by industry, and a hard
 * finish at noon (no lunch slot any more).
 * Kept here, not in the page, so a test can hold the times in order.
 */
export const SCREEN_SCHEDULE: { time: string; title: string; note: string }[] = [
  { time: "10:30", title: "开门 · 签到", note: "到门口扫码签到，到吧台点一份喝的或吃的" },
  { time: "10:45", title: "每人一句", note: "你做哪一行，手上最费时间的是哪件事" },
  { time: "11:00", title: "各行各业的真实用法", note: "一两位成员讲自己那一行怎么用 AI；技术细节带到周二线上" },
  { time: "12:00", title: "收尾 · 结束", note: "扫码打个分，12 点准时结束" },
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
 *
 * Online from 10 November (2026-11-05): James builds a real product live with
 * AI, for 共创会员 (4 weeks at a time) and the 导师团. No ticket.
 */
export const SCREEN_TUESDAY = {
  title: "Build Tuesday · 周二动手局",
  when: "每周二 10:30–12:00 · 线上",
  price: "共创会员参加 · 599 澳元 4 周",
  points: [
    "看 James 用 AI 现场做一个真实的产品",
    "讲哪些产品能赚钱，为什么",
    "4 周一期，够做出一个产品",
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
    title: "今天周二：两个案例，散场前配对。",
    lead: "按自己的节奏推进手上的项目，导师团和共建者在旁边陪跑，不讲课。卡住了随时问。",
    schedule: [
      { time: "10:30", title: "一句话开场", note: "先扫码签到；每人一句：在做什么、卡在哪" },
      { time: "10:45", title: "两个案例", note: "每个 20 分钟，讲完当场拆；其余时间推进自己的项目" },
      { time: "12:00", title: "配对收尾", note: "每人一分钟说卡点，点名谁和谁接着聊；12:30 结束" },
    ],
    signupCaption: "下周二也能报 · 12 人闭门",
    second: {
      eyebrow: "共创会员 · 599 澳元 4 周",
      title: "周二线上，办共创会员",
      price: "一期 4 个周二，看 James 用 AI 做产品",
      points: ["一次付清，不会再扣款", "名片上有「共创会员」标", "刷卡付款，付完马上生效"],
      href: SCREEN_LINKS.join,
      caption: "扫码了解 · vibethursday.com/join",
    },
  };
}
