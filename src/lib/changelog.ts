// Relative, not "@/": the tests load this through Node's type stripper, which
// cannot resolve the tsconfig path alias.
import type { Lang } from "./content.ts";

/**
 * What has changed about the meetup itself, with a version number on it.
 *
 * ★ This is a changelog for the **meetup**, not for the website. The two are
 * not the same history and conflating them would make this useless: the repo
 * has had hundreds of commits, and almost none of them changed anything a
 * person standing in the room would notice. What belongs here is what a
 * regular would feel — the format changed, the venue moved, a new ritual
 * exists. If nobody who comes on Thursday would notice it, it is not a release.
 *
 * The numbering follows that same rule rather than semver's:
 *
 * - **major** — the shape of the morning changed. A new venue, a new time, a
 *   new format. You would have to tell somebody who had been before.
 * - **minor** — something was added that was not there. A new ritual, a new
 *   thing the site does on the day.
 *
 * ⚠️ An entry goes in when the thing is actually live, not when it is built.
 * A published changelog that lists something nobody can find yet is worse than
 * no changelog: it is the one document whose whole value is that it is true.
 *
 * Newest first, which is the order it is read in and the order it is rendered
 * in. Traditional Chinese is converted at render time, the same as the rest of
 * the site's copy.
 */

export type ReleaseKind = "major" | "minor";

/**
 * Where the change happened.
 *
 * ★ Both halves belong here. A changelog that only tracked the website would
 * be a changelog of the wrong thing: most of what a regular actually notices —
 * that nobody goes round the circle introducing themselves any more, that you
 * can walk away from a table without saying goodbye — never touched a line of
 * code. Those changes are recorded in the run sheets and retros kept outside
 * this repo, and this is where they become public.
 */
export type ReleaseScope = "room" | "site";

/**
 * Where to go and see it, for a change that produced something public.
 *
 * ⚠️ Only when the thing is actually reachable by a reader. Check-in, the
 * feedback form and the projector room all need a code in the URL, and the
 * weekly poster is drawn on a page only the organiser can open — a link to any
 * of those would be a link to a locked door, which is worse than no link.
 */
export type ReleaseLink = {
  /** An internal path. `tests/changelog.test.mts` checks every one resolves. */
  href: string;
  zh: string;
  en: string;
};

export type Release = {
  /** "3.0". Unique, and never reused. */
  version: string;
  /** The Sydney date it became true. */
  date: string;
  kind: ReleaseKind;
  scope: ReleaseScope;
  /** One line, in the site's own voice. What changed, not why it is good. */
  zh: string;
  en: string;
  link?: ReleaseLink;
};

export const RELEASES: readonly Release[] = [
  {
    version: "3.4",
    date: "2026-09-25",
    kind: "minor",
    scope: "site",
    zh: "多了一个像素游戏：在真实街道铺成的悉尼里，从环形码头走过海港大桥，坐 T1 去 Chatswood，街上站着成员墙上的人，周四集市的摊位摆着大家做的东西，最后赶上 10:30 的那张桌子。手机能玩，能看见同时在线的人。",
    link: { href: "/play", zh: "去玩一局 →", en: "Play →" },
    en: "There is a pixel game now: a Sydney laid out on the real streets, where you walk from Circular Quay across the Harbour Bridge, take the T1 to Chatswood, meet people from the member wall on the street and their work on stalls at the Thursday market, and make the 10:30 table. It works on a phone, and you can see who else is playing.",
  },
  {
    version: "3.3",
    date: "2026-09-24",
    kind: "minor",
    scope: "site",
    zh: "散场之后多了一张反馈表，只收一周。下一场起，每周的海报换成一套带编号的悉尼卡面，上面的码也从码头链接改成当天的签到码——到场扫一下就签到了。",
    en: "Feedback opens after each morning and closes a week later. From the next session the weekly poster becomes one of a numbered set of Sydney plates, and the code on it becomes that day's check-in code — scan it when you arrive and you are checked in.",
  },
  {
    version: "3.2",
    date: "2026-09-22",
    kind: "minor",
    scope: "site",
    zh: "报名时多问一句：这次来，最想带走什么。",
    link: { href: "/#signup", zh: "去报名表看看 →", en: "See the form →" },
    en: "The sign-up form asks one more thing: what you most want to leave with.",
  },
  {
    version: "3.1",
    date: "2026-09-18",
    kind: "minor",
    scope: "site",
    zh: "下一场的页面在那天到来之前就打得开了。在那之前，它要等到当天才存在。",
    link: { href: "/sessions", zh: "看场次 →", en: "Sessions →" },
    en: "The page for the session coming up opens before the morning does. Until then it did not exist until the day itself.",
  },
  {
    version: "3.0",
    date: "2026-09-17",
    kind: "major",
    scope: "room",
    // The venue and the time, as the home page already states them. 09-17 is
    // the first morning that actually ran there — the announcement was the day
    // before, and the field above is documented as the date it became true.
    zh: "搬到 Chatswood 的 The Avenue。新场地 10:30 才开门，所以整场往后挪了半小时，开门就开始。",
    link: { href: "/sessions/2026-09-17", zh: "搬过去之后的第一场 →", en: "The first morning there →" },
    en: "Moved to The Avenue in Chatswood. The new room opens at 10:30, so the whole morning shifted half an hour later and now starts when the doors do.",
  },
  {
    version: "2.8",
    date: "2026-09-10",
    kind: "minor",
    scope: "site",
    zh: "签到：扫桌上的码，点自己的名字。这个站第一次知道谁真的来了，而不只是谁报了名——每一场也因此有了自己的页面：那天是谁、聊了什么、照片。",
    link: { href: "/sessions", zh: "每一场的页面 →", en: "Every session has a page →" },
    en: "Check-in: scan the code on the table, tap your own name. The first time this site knew who actually came rather than who meant to — and so each session got a page of its own: who was there, what was asked, the photographs.",
  },
  {
    version: "2.7",
    date: "2026-09-03",
    kind: "minor",
    scope: "site",
    zh: "房间里没有投影仪，所以每个人的手机就是屏幕——开一个房间，大家扫码跟着看。",
    en: "There is no projector, so everyone's phone is the screen: open a room, and it follows along.",
  },
  {
    version: "2.6",
    date: "2026-09-03",
    kind: "minor",
    scope: "room",
    zh: "开场固定成三句、大约五十秒：第一次来的举个手；一起把群昵称改成「名字 + 在做什么」；随时换桌。散场时在群里发一条接龙。",
    en: "The opening became three sentences, about fifty seconds: hands up if it is your first time; let's all rename ourselves in the group to name plus what we are building; move tables whenever you like. At the end, one message goes to the group.",
  },
  {
    version: "2.5",
    date: "2026-08-28",
    kind: "minor",
    scope: "site",
    zh: "每一场变成一个东西：一张画、一份存档、累计的数字。码头上的问题可以被回答了。",
    link: { href: "/works", zh: "攒下来的作品 →", en: "What has been built →" },
    en: "Each session became a thing of its own — a painting, an archive entry, a running count. Questions on the Wharf can be answered.",
  },
  {
    version: "2.4",
    date: "2026-08-27",
    kind: "minor",
    scope: "site",
    zh: "码头：把大家报名时写下的那个问题挂出来，谁都能看见，谁都能接。",
    link: { href: "/wharf", zh: "去码头 →", en: "The Wharf →" },
    en: "The Wharf: the question you wrote when you signed up goes up where everyone can see it, and anyone can take it.",
  },
  {
    version: "2.3",
    date: "2026-08-27",
    kind: "minor",
    scope: "room",
    zh: "取消「每桌派人回全场汇报」。轮流汇报会把一场酒会变回一场会——删掉它，比给它定规矩便宜。",
    en: "Dropped the round of table reports. Taking turns to report back turns a party into a meeting — deleting it was cheaper than making rules for it.",
  },
  {
    version: "2.2",
    date: "2026-08-20",
    kind: "minor",
    scope: "room",
    // ⚠️ 脱敏：主持的人不点名。
    zh: "桌子按主题分，进门自己挑一张坐，不按名单安排。这一场主理人不在，由另一位常来的人主持——它第一次证明这个局不靠某一个人。",
    link: { href: "/sessions/2026-08-20", zh: "那一场 →", en: "That session →" },
    en: "Tables are by topic and you pick one on the way in; nobody is assigned. This was also the first session run by somebody other than the organiser, who was away — the first proof that it does not depend on one person.",
  },
  {
    version: "2.1",
    date: "2026-08-15",
    kind: "minor",
    scope: "site",
    zh: "繁体中文，以及简 / 繁 / EN 的切换。",
    en: "Traditional Chinese, and a switch between Simplified, Traditional and English.",
  },
  {
    version: "2.0",
    date: "2026-08-13",
    kind: "major",
    scope: "room",
    zh: "形式整个换掉。不再绕一圈做自我介绍——三十个人轮一圈要半小时，讲完前面的就忘了；改成只有第一次来的人讲一句。分享一人五分钟、讲完就下、当场不问答，问题留到后面。之后分成几张小桌，讨论在桌上发生。明说一条规矩：走开不用打招呼。",
    en: "The whole format changed. No more going round the circle — thirty people take half an hour and you have forgotten the first by the last; now only first-timers say a line. Talks are five minutes each, no questions on the spot, and then the room splits into small tables where the actual discussion happens. One rule said out loud: you can walk away without saying goodbye.",
  },
  {
    version: "1.2",
    date: "2026-08-09",
    kind: "minor",
    scope: "site",
    zh: "成员墙：一人一张卡。手机立在桌上就是桌牌。",
    link: { href: "/members", zh: "成员墙 →", en: "The member wall →" },
    en: "The member wall: one card each. Stand your phone up and it is your name badge.",
  },
  {
    version: "1.1",
    date: "2026-08-07",
    kind: "minor",
    scope: "site",
    zh: "报名改成累积场次——来过的人回来只需要选这次来哪天。表单里多了一句「这周想聊点什么」。",
    link: { href: "/#signup", zh: "报名表 →", en: "The sign-up form →" },
    en: "Sign-ups accumulate across sessions, so coming back is just picking the day. The form gained one line: what you want to talk about this week.",
  },
  {
    version: "1.0",
    date: "2026-08-06",
    kind: "major",
    scope: "room",
    zh: "第一场。每周四上午，一群在做东西的人围一张桌子：轮流自我介绍，然后几个人讲讲自己在做什么。",
    link: { href: "/sessions/2026-08-06", zh: "第一场 →", en: "The first session →" },
    en: "The first one. Thursday morning, one table, people who are building things: everyone introduces themselves in turn, then a few show what they are working on.",
  },
] as const;

/** What the site is running right now — the newest release's number. */
export function currentVersion(): string {
  return RELEASES[0].version;
}

/**
 * A release's date, in the reader's language.
 *
 * ⚠️ Deliberately NOT `formatSession`. That one renders every date as
 * "8月6日（周四）" with the weekday hard-coded, because every date it was
 * written for is a Thursday. Most dates here are not: the format changed on a
 * Wednesday, the member wall landed on a Saturday. Reusing it would have
 * printed "（周四）" under a third of these entries, confidently and wrongly.
 *
 * No weekday at all rather than a computed one: what matters about a release
 * is when it became true, and nobody needs to know it was a Tuesday.
 */
export function releaseDate(iso: string, lang: Lang): string {
  const date = new Date(`${iso}T00:00:00Z`);

  if (lang === "en") {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  // Traditional and Simplified write a date the same way; only the prose
  // around it is converted.
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}
