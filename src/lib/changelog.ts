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

export type Release = {
  /** "3.0". Unique, and never reused. */
  version: string;
  /** The Sydney date it became true. */
  date: string;
  kind: ReleaseKind;
  /** One line, in the site's own voice. What changed, not why it is good. */
  zh: string;
  en: string;
};

export const RELEASES: readonly Release[] = [
  {
    version: "3.3",
    date: "2026-09-24",
    kind: "minor",
    // ⚠️ Worded for what is true on the date above, not for what was built on
    // it. The feedback form is live today and this morning is inside its own
    // window; the poster changed today but this week's had already gone out in
    // the old shape, so the first card is next week's. "一场一张画" was cut
    // too — there are seven plates and they come round, the serial is the part
    // that never repeats.
    zh: "散场之后多了一张反馈表，只收一周。下一场起，每周的海报换成一套带编号的悉尼卡面，上面的码也从码头链接改成当天的签到码——到场扫一下就签到了。",
    en: "Feedback opens after each morning and closes a week later. From the next session the weekly poster becomes one of a numbered set of Sydney plates, and the code on it becomes that day's check-in code — scan it when you arrive and you are checked in.",
  },
  {
    version: "3.2",
    date: "2026-09-22",
    kind: "minor",
    zh: "报名时多问一句：这次来，最想带走什么。",
    en: "The sign-up form asks one more thing: what you most want to leave with.",
  },
  {
    version: "3.1",
    date: "2026-09-18",
    kind: "minor",
    // ⚠️ Narrower than it first read. The session page itself shipped with
    // check-in on 09-10 (v2.5, same commit); what 09-18 added is that the page
    // exists *before* the morning does — until then it 404'd until the day.
    zh: "下一场的页面在那天到来之前就打得开了。在那之前，它要等到当天才存在。",
    en: "The page for the session coming up opens before the morning does. Until then it did not exist until the day itself.",
  },
  {
    version: "3.0",
    // ⚠️ 09-17, not 09-16. The 16th is when the move was announced and the
    // site was updated; the room only changed for anybody on the morning of
    // the 17th, which is the first session that actually ran there. The field
    // above is documented as the date it became true, and for a changelog
    // about the meetup rather than about the website, that is the morning.
    date: "2026-09-17",
    kind: "major",
    // The venue and the opening time, stated as the home page already states
    // them. Nothing about why, nothing about what it costs — those are
    // settled decisions kept outside this repo, and a changelog restates
    // public facts rather than reopening them.
    zh: "搬到 Chatswood 的 The Avenue。新场地 10:30 才开门，所以开门就开始。",
    en: "Moved to The Avenue in Chatswood. The new room opens at 10:30, so that is when we start.",
  },
  {
    version: "2.5",
    date: "2026-09-10",
    kind: "minor",
    zh: "签到：扫桌上的码，点自己的名字。这个站第一次知道谁真的来了，而不只是谁报了名——每一场也因此有了自己的页面：那天是谁、聊了什么、照片。",
    en: "Check-in: scan the code on the table, tap your own name. The first time this site knew who actually came rather than who meant to — and so each session got a page of its own: who was there, what was asked, the photographs.",
  },
  {
    version: "2.4",
    date: "2026-09-03",
    kind: "minor",
    zh: "房间里没有投影仪，所以每个人的手机就是屏幕——开一个房间，大家扫码跟着看。",
    en: "There is no projector, so everyone's phone is the screen: open a room, and it follows along.",
  },
  {
    version: "2.3",
    date: "2026-08-28",
    kind: "minor",
    zh: "每一场变成一个东西：一张画、一份存档、累计的数字。码头上的问题可以被回答了。",
    en: "Each session became a thing of its own — a painting, an archive entry, a running count. Questions on the Wharf can be answered.",
  },
  {
    version: "2.2",
    date: "2026-08-27",
    kind: "minor",
    zh: "码头：把大家报名时写下的那个问题挂出来，谁都能看见，谁都能接。",
    en: "The Wharf: the question you wrote when you signed up goes up where everyone can see it, and anyone can take it.",
  },
  {
    version: "2.1",
    date: "2026-08-15",
    kind: "minor",
    zh: "繁体中文，以及简 / 繁 / EN 的切换。",
    en: "Traditional Chinese, and a switch between Simplified, Traditional and English.",
  },
  {
    version: "2.0",
    date: "2026-08-13",
    kind: "major",
    zh: "改成小桌制：不再是轮流上台讲，而是分成几张小桌，想听哪桌就坐哪桌。",
    en: "Changed to small tables: no one takes the floor in turn any more — the room splits, and you sit at whichever table you want to hear.",
  },
  {
    version: "1.2",
    date: "2026-08-09",
    kind: "minor",
    zh: "成员墙：一人一张卡。手机立在桌上就是桌牌。",
    en: "The member wall: one card each. Stand your phone up and it is your name badge.",
  },
  {
    version: "1.1",
    date: "2026-08-07",
    kind: "minor",
    zh: "报名改成累积场次——来过的人回来只需要选这次来哪天。表单里多了一句「这周想聊点什么」。",
    en: "Sign-ups accumulate across sessions, so coming back is just picking the day. The form gained one line: what you want to talk about this week.",
  },
  {
    version: "1.0",
    date: "2026-08-06",
    kind: "major",
    zh: "第一场。每周四上午，一群在做东西的人围一张桌子。",
    en: "The first one. Thursday morning, a table, and people who are building things.",
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
