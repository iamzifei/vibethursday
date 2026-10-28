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
      { name: "开场分享", text: "两三位朋友各讲 5 分钟，讲完大家随便问。" },
      { name: "需求一句话", text: "有想让 AI 帮忙的事，举手说一句，做过的人当场认领。" },
      { name: "自由聊", text: "去找刚才想认识的那个人。" },
    ],

    waysTitle: "四种来法，挑一样就够",
    ways: [
      { icon: "listen", name: "来听听", text: "什么都不说也没关系。第一次来，先坐下点杯咖啡。" },
      { icon: "ask", name: "说个需求", text: "「我是做××的，想让 AI 帮我××。」一句话就行。" },
      { icon: "share", name: "上台 5 分钟", text: "报名时选「想，我来分享」。不用 PPT，打开手机给大家看。" },
      { icon: "help", name: "帮一把", text: "听到你做过的事，举个手。" },
    ] as { icon: GuideIcon; name: string; text: string }[],

    principlesTitle: "八条约定",
    principles: [
      { id: "p1", head: "周四永远免费。", text: "不卖票，随来随走。" },
      { id: "p2", head: "不懂也欢迎。", text: "谁都有过第一次打开 AI、不知道该问什么的时候。这里没有傻问题。" },
      { id: "p3", head: "讲真做过的。", text: "做成了讲结果，没做成讲卡在哪。少用术语，屋里有程序员，也有开店的老板。" },
      { id: "p4", head: "需求说出口，才有人接。", text: "说得越具体，越容易遇到对的人。" },
      { id: "p5", head: "能帮就举手。", text: "你随口一句，可能帮别人省下一个下午。" },
      { id: "p6", head: "台上不卖东西。", text: "讲做法，不打广告，不拉人报课。" },
      { id: "p7", head: "听到的留在屋里。", text: "别人讲到的客户名字、生意数字，不往外传。" },
      { id: "p8", head: "做了事的人，我们记得。", text: "每周五在群里点名谢谢上台和帮忙的朋友；周二的小范围研讨，也先请他们。" },
    ],

    closeTitle: "想上台讲 5 分钟？",
    closeText: "报名周四时选「想，我来分享」，或者在群里私信主理人。讲你最近真做过的一件事就好。",
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
      { name: "Opening shares", text: "Two or three people get five minutes each. Then anyone can ask." },
      { name: "One-line asks", text: "Want AI to help with something? Say it in a sentence. Someone who has done it puts a hand up." },
      { name: "Open floor", text: "Go and find the person you wanted to meet." },
    ],

    waysTitle: "Four ways in. Pick one.",
    ways: [
      { icon: "listen", name: "Just listen", text: "You don't have to say a word. First time? Grab a coffee and sit down." },
      { icon: "ask", name: "Ask for something", text: "“I run a ___, I'd like AI to ___.” One sentence is plenty." },
      { icon: "share", name: "Take five minutes", text: "Pick “Yes, I'll share” when you sign up. No slides, just show us on your phone." },
      { icon: "help", name: "Lend a hand", text: "Hear something you've done before? Put your hand up." },
    ] as { icon: GuideIcon; name: string; text: string }[],

    principlesTitle: "Eight things we ask",
    principles: [
      { id: "p1", head: "Thursdays are always free.", text: "No tickets. Come and go as you like." },
      { id: "p2", head: "Beginners welcome.", text: "Everyone once opened an AI app with no idea what to type. There are no silly questions here." },
      { id: "p3", head: "Talk about what you actually did.", text: "If it worked, show the result. If it didn't, show where it got stuck. Go easy on jargon: the room has developers and shop owners." },
      { id: "p4", head: "Say what you need.", text: "The more specific you are, the likelier you meet the right person." },
      { id: "p5", head: "If you can help, put your hand up.", text: "One line from you might save someone an afternoon." },
      { id: "p6", head: "No selling from the front.", text: "Share how you did it. No ads, no course pitches." },
      { id: "p7", head: "What's said in the room stays there.", text: "Client names and business numbers you hear don't leave with you." },
      { id: "p8", head: "We remember who pitched in.", text: "Every Friday we thank the people who shared and helped, by name, in the group. They're also first to be asked to the small Tuesday sessions." },
    ],

    closeTitle: "Want five minutes at the front?",
    closeText: "Pick “Yes, I'll share” when you sign up for a Thursday, or message the host in the group. Something you did recently is all it takes.",
    cta: "Sign up for Thursday",
    tuesdayLink: "What's Tuesday?",
    anchorLabel: (n: string) => `Link to point ${n}`,
  },
};

export type GuideCopy = (typeof GUIDE_COPY)["zh"];
