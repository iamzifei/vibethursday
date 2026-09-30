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
    version: "4.9",
    date: "2026-09-30",
    kind: "minor",
    scope: "site",
    zh: "周四当天的 /go 更顺手了：10 点前提醒你记得签到，10 点起那一项变成签到链接；签上之后直接打开你的名牌，还没填过名片的，直接带你去填。10 点以后 /go 上不再有点单入口——单子那时已经交给吧台了，到了直接跟吧台点；之前点过的照样能看。当天还会列出本周的候选问题。",
    link: { href: "/go", zh: "打开 /go →", en: "Open /go →" },
    en: "/go on the day is smoother: before 10am it reminds you to check in, and from 10am that line becomes the check-in link. Checking in opens your badge straight away — or, if you have no card yet, takes you to fill one in. From 10am /go no longer offers ordering, because the list has already gone to the bar; order at the counter instead, and an order you already placed is still there to see. The week's candidate questions are listed on the day too.",
  },
  {
    version: "4.8",
    date: "2026-09-29",
    kind: "minor",
    scope: "site",
    zh: "码头去重：不同的人问了同一个问题，现在只挂一条，下面写上所有问过的人；同一个人换着说法问了好几遍的，也合成一条。哪句话留下来，是其中一位提问的人自己写的原话。在码头问新问题时，如果之前有人问过差不多的：已经有人答了，先带你去看回答，看完没解决还可以接着问；还没人答，你的名字就加到那条下面，觉得不是一回事，点一下就能单独挂出来。",
    link: { href: "/wharf", zh: "去码头看看 →", en: "See the Wharf →" },
    en: "The Wharf is de-duplicated: when several people asked the same question it now appears once, with everyone who asked it named underneath; one person asking the same thing in different words is folded into one too. The wording kept is always one of the askers' own. When you ask something new on the Wharf and a similar question is already there: if it has an answer, you are shown the answer first and can still ask if it did not help; if it has not, your name goes under that question — and one tap posts yours on its own if it is not the same thing.",
  },
  {
    version: "4.7",
    date: "2026-09-28",
    kind: "minor",
    scope: "site",
    zh: "像素游戏有了本周榜：抢咖啡豆（隔一两分钟在地图上冒出一颗，先到先得）、和人击掌、每天来、做完当天三件事都能加分，周四真的到场一次加一大笔；周四上午分数翻倍。每周一清零，上周第一名这周头上戴皇冠。分只在游戏里算，不上名片、不能换东西。",
    link: { href: "/play", zh: "去抢咖啡豆 →", en: "Go grab a bean →" },
    en: "The pixel game has a weekly board: grab the coffee bean (one appears every minute or two, first one there gets it), high-five people, show up each day and finish the day's three tasks — and being in the room on Thursday counts for a lot; Thursday morning is double points. It resets every Monday, and last week's winner wears a crown all week. Points only count in the game — not on cards, not for anything.",
  },
  {
    version: "4.6",
    date: "2026-09-28",
    kind: "minor",
    scope: "site",
    zh: "这台手机记得你：报过一次名、或者在 /my 查过一次，用同一台手机再打开 vibethursday.com/my 或 /go，直接看到自己报了哪几场、是不是在候补，不用再填名字和微信号。借别人手机报的，点「不是你？」就能清掉。候补按进候补的先后排队。",
    link: { href: "/my", zh: "查我的报名 →", en: "Check my signup →" },
    en: "This phone remembers you: sign up once, or look yourself up on /my once, and opening vibethursday.com/my or /go on the same phone shows your Thursdays and any waitlist straight away — no name or WeChat ID to type. Signed up on someone else's phone? Tap «Not you?» to clear it. The waitlist now queues in the order people joined it.",
  },
  {
    version: "4.5",
    date: "2026-09-28",
    kind: "minor",
    scope: "site",
    zh: "候补说清楚了：座位满了进候补，候补照样能来，只是没有预留座位，不用再报别的周四兜底。报名成功后会列出你现在报的所有场次；「我的名片」页顶上也能看到自己报了哪几场，一键去改。报名表会帮你分清微信号和昵称，写明去哪里找；在 /my 名字对不上时，会提示你报名时用的是哪个名字。",
    link: { href: "/my", zh: "查我的报名 →", en: "Check my signup →" },
    en: "The waitlist is explained: once the seats are taken you join the waitlist, and waitlisted people can still come, just without a reserved seat — no need to sign up for another Thursday as a fallback. After signing up you see every Thursday you are down for, and the top of «My card» shows them too, with a link to change them. The form now helps tell a WeChat ID from a nickname and says where to find it, and /my tells you when a WeChat ID is signed up under a different name.",
  },
  {
    version: "4.4",
    date: "2026-09-28",
    kind: "minor",
    scope: "site",
    zh: "报了名之后自己能查、能改：打开 vibethursday.com/my，填名字和微信号，就能看到报了哪几场、是不是在候补，也能改到别的周四或者取消，把位子让给候补的人。还没发布的名片不再给出扫不开的二维码；扫到不存在的页面，会告诉你可能的原因和下一步。",
    link: { href: "/my", zh: "查我的报名 →", en: "Check my signup →" },
    en: "You can now check and change your own signup: open vibethursday.com/my, enter your name and WeChat ID, and see which Thursdays you are down for and whether you are on a waitlist — then move to another Thursday, or cancel and free your place for someone waiting. Unpublished cards no longer hand out a QR code that opens nothing, and a page that does not exist now says why that might be and where to go instead.",
  },
  {
    version: "4.3",
    date: "2026-09-28",
    kind: "minor",
    scope: "site",
    zh: "手机上更快找到要的东西：首页往下一屏就是报名表，快满时写明还剩几个位子；点单页按类别收起，一屏点完一杯，「就点这个」一直在屏幕底部；成员墙在手机上每人一行半，名字、来过几次、想找什么，周四当场扫一眼就能找到人。相册的照片按屏幕挑合适的尺寸，打开更快。",
    link: { href: "/members", zh: "看成员墙 →", en: "See the wall →" },
    en: "Easier to find things on a phone: the sign-up form is one screen down on the home page, and says how many places are left when a session is nearly full; the order page folds the menu by category so one drink takes one screen, with the button always at the bottom; and the member wall shows each person in a line and a half — name, how often they have come, what they are looking for — so you can find someone at a glance on the Thursday. Album photos come in the right size for the screen and open faster.",
  },
  {
    version: "4.2",
    date: "2026-09-28",
    kind: "minor",
    scope: "site",
    zh: "vibethursday.com/go 上能看到本周的候选问题，活动当天变成「今天聊这几个问题」，上午还能直接点进签到；报满 40 人的场次写明「已满，登记候补」。码头同一个人的同一句话只留一条，过期的收起来。各页在手机上更好点、更好读，繁体页的用字也修齐了。",
    link: { href: "/go", zh: "看本周 →", en: "This week →" },
    en: "vibethursday.com/go now shows this week's candidate questions, turns into \"today we talk about\" on the morning, and links straight to check-in that morning; a full session says so and offers the waitlist. The Wharf shows each person's question once and folds the stale ones. Pages are easier to tap and read on a phone, and the Traditional Chinese pages use the right characters.",
  },
  {
    version: "4.1",
    date: "2026-09-28",
    kind: "minor",
    scope: "site",
    zh: "只记一个链接就够了：vibethursday.com/go，按日期自己换内容——场前报名、点单、名片，当天签到和我的单，散场后反馈。喝的可以提前在网站上点，到了跟吧台报名字取。报名表更短，「最想问什么」可以让 AI 追问一句，帮你问得更具体。",
    link: { href: "/go", zh: "看本周 →", en: "This week →" },
    en: "One link is enough now: vibethursday.com/go, which changes by itself with the date — signing up, ordering and your card before, check-in and your order on the day, feedback after. Drinks can be ordered ahead on the site and picked up by name. The sign-up form is shorter, and the «what do you most want to ask» box can ask you one follow-up question to make it more specific.",
  },
  {
    version: "4.0",
    date: "2026-09-28",
    kind: "major",
    scope: "room",
    zh: "形式改了：10:30 开门、10:45 开始，不再分桌，全场一起——开场、新朋友一句话介绍、本周主题、两个提前投票选出的问题聊透，最后写下想认识谁。",
    link: { href: "/#schedule", zh: "看新的流程 →", en: "See the run of show →" },
    en: "The format changed: doors at 10:30, start at 10:45, and no more tables — the whole room together: a welcome, one line from each first-timer, the week's topic, two questions voted on beforehand and talked through properly, then a sheet for who you want to meet.",
  },
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
