/**
 * Words on /guide (2026-10-28): how a Thursday works and what we ask of each
 * other, short enough to read on a phone in a minute and to quote in the group.
 *
 * Kept apart from content.ts, which is already the site's largest file. Two
 * written languages, like everywhere else; the page derives Traditional.
 *
 * ⚠️ Each principle's `id` is part of a public URL (`/guide#p3`) that gets
 * pasted into the group chat. Reordering is fine; renumbering an id breaks
 * every link already sent. `tests/guide.test.mts` holds the ids stable.
 */

/** One of the pictograms drawn by the page. */
export type GuideIcon = "listen" | "ask" | "share" | "help";

export const GUIDE_COPY = {
  zh: {
    meta: {
      title: "社区攻略 · Vibe Thursday",
      description: "悉尼每周四上午的 AI 聚会怎么玩：一个上午三段，四种参与方式，八条约定。一分钟看完。",
    },
    eyebrow: "Vibe Thursday · 社区攻略",
    title: ["我们", "这样过", "周四"],
    lede: "悉尼每周四上午，一屋子用 AI 做事的人。来之前花一分钟，看看这里的规矩。",

    dayTitle: "一个上午，三段",
    day: [
      { name: "每人一句", text: "轮一圈，说你做哪一行、手上最费时间的是哪件事。" },
      { name: "行业里的真实用法", text: "一两位成员讲自己那一行怎么用 AI：省了多少、哪些试过不行。" },
      { name: "找同行", text: "散场前找到同行，加个微信，接着聊。" },
    ],

    waysTitle: "四种来法，挑一样就够",
    ways: [
      { icon: "listen", name: "来听听", text: "不用上台，轮到你时说一句做哪一行就行。第一次来，先坐下点杯咖啡。" },
      { icon: "ask", name: "说个需求", text: "「我是做××的，想让 AI 帮我××。」一句话就行。" },
      { icon: "share", name: "讲讲你那一行", text: "报名时选「想，我来分享」。讲你那一行交给 AI 的一件事，选中的会提前私信你。" },
      { icon: "help", name: "帮一把", text: "听到你做过的事，举个手。" },
    ] as { icon: GuideIcon; name: string; text: string }[],

    principlesTitle: "八条约定",
    principles: [
      { id: "p1", head: "周四永远免费。", text: "不卖票，随来随走。到了在店里点一份喝的或吃的，这是我们和场地的约定。" },
      { id: "p2", head: "不懂也欢迎。", text: "谁都有过第一次打开 AI、不知道该问什么的时候。这里没有傻问题。" },
      { id: "p3", head: "讲真做过的。", text: "做成了讲结果，没做成讲卡在哪。少用术语，屋里有程序员，也有开店的老板。" },
      { id: "p4", head: "需求说出口，才有人接。", text: "说得越具体，越容易遇到对的人。" },
      { id: "p5", head: "能帮就举手。", text: "你随口一句，可能帮别人省下一个下午。" },
      { id: "p6", head: "台上不卖东西。", text: "讲做法，不打广告，不拉人报课。" },
      { id: "p7", head: "听到的留在屋里。", text: "别人讲到的客户名字、生意数字，不往外传。" },
      { id: "p8", head: "做了事的人，我们记得。", text: "每周五在群里点名谢谢上台和帮忙的朋友。分享多、帮忙多的朋友，还会被请进一个小圈子。" },
    ],

    closeTitle: "想讲讲你那一行怎么用 AI？",
    closeText: "报名周四时选「想，我来分享」，或者私信主理人。讲你那一行真交给 AI 做过的一件事：以前怎么做，现在省了多少，哪些试过不行。",
    cta: "报名周四",
    tuesdayLink: "周二是什么",
    anchorLabel: (n: string) => `第 ${n} 条的链接`,
  },

  en: {
    meta: {
      title: "How it works · Vibe Thursday",
      description:
        "How Sydney's Thursday-morning AI meetup works: three parts to the morning, four ways to join in, eight things we ask of each other. A one-minute read.",
    },
    eyebrow: "Vibe Thursday · How it works",
    title: ["How we", "spend", "Thursdays"],
    lede: "Every Thursday morning in Sydney, a room full of people doing real things with AI. Take a minute before you come.",

    dayTitle: "One morning, three parts",
    day: [
      { name: "One line each", text: "Round the room: what line of work you're in, and what takes up most of your time." },
      { name: "Real uses, by industry", text: "One or two members show how AI is used in their line of work: what it saves, and what didn't work." },
      { name: "Find your people", text: "Before you leave, find the people in your field and swap WeChat." },
    ],

    waysTitle: "Four ways in. Pick one.",
    ways: [
      { icon: "listen", name: "Just listen", text: "You don't have to present. When it comes round, just say what line of work you're in. First time? Grab a coffee and sit down." },
      { icon: "ask", name: "Ask for something", text: "“I run a ___, I'd like AI to ___.” One sentence is plenty." },
      { icon: "share", name: "Show your industry", text: "Pick “Yes, I'll share” when you sign up. Talk about one thing your line of work handed to AI; if you're picked, you'll hear from us beforehand." },
      { icon: "help", name: "Lend a hand", text: "Hear something you've done before? Put your hand up." },
    ] as { icon: GuideIcon; name: string; text: string }[],

    principlesTitle: "Eight things we ask",
    principles: [
      { id: "p1", head: "Thursdays are always free.", text: "No tickets. Come and go as you like. Order one thing from the venue when you arrive: that's our deal with them." },
      { id: "p2", head: "Beginners welcome.", text: "Everyone once opened an AI app with no idea what to type. There are no silly questions here." },
      { id: "p3", head: "Talk about what you actually did.", text: "If it worked, show the result. If it didn't, show where it got stuck. Go easy on jargon: the room has developers and shop owners." },
      { id: "p4", head: "Say what you need.", text: "The more specific you are, the likelier you meet the right person." },
      { id: "p5", head: "If you can help, put your hand up.", text: "One line from you might save someone an afternoon." },
      { id: "p6", head: "No selling from the front.", text: "Share how you did it. No ads, no course pitches." },
      { id: "p7", head: "What's said in the room stays there.", text: "Client names and business numbers you hear don't leave with you." },
      { id: "p8", head: "We remember who pitched in.", text: "Every Friday we thank the people who shared and helped, by name, in the group. The ones who share and help most get invited into a smaller circle." },
    ],

    closeTitle: "Want to show how your industry uses AI?",
    closeText: "Pick “Yes, I'll share” when you sign up for a Thursday, or message the host. One thing your line of work really handed to AI: how it was done before, what it saves now, and what didn't work.",
    cta: "Sign up for Thursday",
    tuesdayLink: "What's Tuesday?",
    anchorLabel: (n: string) => `Link to point ${n}`,
  },
};

export type GuideCopy = (typeof GUIDE_COPY)["zh"];
