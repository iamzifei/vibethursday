/**
 * All user-facing copy, in both languages.
 *
 * The community starts Chinese-first and goes bilingual once it outgrows a
 * single table, so Chinese is the default and English is a peer translation
 * rather than an afterthought. Keeping both in one shaped object means the
 * page components never branch on language — they just read `copy[lang]`.
 */

export type Lang = "zh" | "en";

export const LANGS: Lang[] = ["zh", "en"];

export function resolveLang(value: string | undefined): Lang {
  return value === "en" ? "en" : "zh";
}

export const copy = {
  zh: {
    htmlLang: "zh-CN",
    langSwitchLabel: "English",
    langSwitchHref: "/?lang=en",

    meta: {
      title: "Vibe Thursday · 悉尼每周四的 AI 局",
      description:
        "每周四上午，悉尼 CBD。带上你用 AI 做的任何东西，5 分钟讲给一屋子懂的人听。会坏的 demo 也欢迎。免费。",
    },

    nav: {
      brand: "Vibe Thursday",
      cta: "报名",
    },

    hero: {
      eyebrow: "SYDNEY · EVERY THURSDAY",
      title: "Vibe Thursday",
      subtitle: "悉尼 · 每周四上午的 AI 局",
      lede: "带上你用 AI 做出来的任何东西——一个网站、一段脚本、一条自动化流程、一个剪片工具，甚至一个还没跑通的想法。5 分钟，讲给一屋子听得懂的人。",
      facts: [
        { label: "时间", value: "每周四 10:00–13:00" },
        { label: "地点", value: "悉尼 CBD" },
        { label: "费用", value: "免费，咖啡自理" },
      ],
      cta: "报名下一场",
      ctaSecondary: "先看看是什么",
      note: "12:00 之后自愿留下吃个午饭。赶着接娃或者要回去干活的，12 点直接走就行。",
    },

    what: {
      eyebrow: "§ 01 — 这是什么",
      title: "一句话：每周四上午，一群人围一张桌子，看彼此用 AI 做了什么。",
      lede: "灵感来自北京中关村的每周四聚会。悉尼已经有很多每月一次的晚间活动，但没有一个每周固定的白天局——月度活动是日程表上的条目，每周才会变成习惯。",
      points: [
        {
          title: "不是讲座",
          body: "没有主讲嘉宾，没有汇报型 PPT，没有台上台下。笔记本传着看，随时打断提问。",
        },
        {
          title: "会坏的 demo 也欢迎",
          body: "跑不通的东西往往比跑通的更值得聊。这里不评判完成度，只看你到底试了什么。",
        },
        {
          title: "展示可以，插播不行",
          body: "你做的东西就是你最好的宣发，大方讲。但别人讲的时候别转成你的推销——猎头抓人、中介拉客、收完名单就走的，不欢迎。",
        },
      ],
    },

    who: {
      eyebrow: "§ 02 — 谁适合来",
      title: "只要你真的在用 AI 做点什么，或者真的想开始。",
      groups: [
        "独立开发者",
        "全职创业 / 在做自己的产品",
        "自由职业 / 数字游民",
        "公司里对 AI 感兴趣的工程师",
        "带团队、想把 AI 落到流程里的中层",
        "AI 方向的自媒体和内容创作者",
      ],
      note: "工作日上午本身就是筛选器。周四十点能出现的人，多半已经靠 AI 做出了点什么——这正是我们想先攒起来的那批人。",
    },

    schedule: {
      eyebrow: "§ 03 — 流程",
      title: "每周同一个节奏，不变。",
      slots: [
        {
          time: "10:00–10:30",
          title: "陆续到场 · 一句话自我介绍",
          note: "三件事：怎么称呼、在做什么、现在卡在哪。",
        },
        {
          time: "10:30–11:30",
          title: "Demo 轮",
          note: "最多 3 个名额，每人 5 分钟，硬计时。想讲在报名时勾一下就行。",
        },
        {
          time: "11:30–12:00",
          title: "开放时间 · 求助 & 需求",
          note: "一人一句：现在卡在哪、在找什么（用户 / 合伙人 / 反馈 / 工作）。想推的东西在这一段说。",
        },
        {
          time: "12:00 之后",
          title: "自愿留下吃午饭",
          note: "不强制。想接着聊的一起吃，赶时间的 12 点就走。",
        },
      ],
    },

    rules: {
      eyebrow: "§ 04 — 几条规矩",
      title: "就这五条。",
      items: [
        "只来两个人也照办。周更一旦取消过一次就死了。",
        "同一时间、同一地点，每周不变。不轮换场地。",
        "免费，不售票。报名只是为了估人数。",
        "Demo 永远是可选的。有就讲，没有就听。",
        "展示可以，插播不行。你做的东西就是你的宣发，在自己的时段里大方讲；别人讲的时候别转成推销。只来收名单、抓人、拉客的，会被请出去。",
      ],
    },

    signup: {
      eyebrow: "§ 05 — 报名",
      title: "报个名，我把地址发给你。",
      lede: "场地按人数定——人少就是咖啡厅一张大桌，人多了才换有屏幕的房间。所以报名对我确定场地真的有用。",
      fields: {
        name: "怎么称呼你",
        namePlaceholder: "名字或网名都行",
        email: "邮箱",
        emailPlaceholder: "选填",
        emailRequired: false,
        wechat: "微信号",
        wechatPlaceholder: "微信号，不是昵称",
        wechatRequired: true,
        wechatHint: "现阶段活动通知走微信群，留了我拉你进群。",
        contactPrivacy: "这两栏只有我（活动组织者）看得到。不公开、不给第三方、不拿去发广告，也不会有人拿它加你推销。",
        building: "你在做什么？",
        buildingPlaceholder: "在做的产品、在折腾的东西、或者只是最近在学什么。一两句就够。",
        demoIntent: "这次想 demo 吗？",
        demoOptions: [
          { value: "yes", label: "想讲" },
          { value: "maybe", label: "也许" },
          { value: "listen", label: "先来听听" },
        ],
        session: "打算参加哪一场？",
        source: "怎么知道这个活动的？",
        sourcePlaceholder: "选填",
      },
      submit: "提交报名",
      submitting: "提交中…",
      successTitle: "收到了。",
      successBody: "地址和当周提醒会发到你的邮箱。留了微信号的话，我会另外拉你进群。",
      errorGeneric: "提交失败了。稍等一下再试一次，或者直接扫码加我微信。",
      errorRobot: "人机验证没通过。刷新页面重试一次。",
      errorRequired: "名字和微信号是必填的。",
      errorNeedContact: "至少留一个联系方式，微信号或邮箱都行。",
      errorEmail: "这个邮箱地址看起来不太对。",
    },

    faq: {
      eyebrow: "§ 06 — 常见问题",
      title: "先回答几个大概率会问的。",
      items: [
        {
          q: "我什么都还没做出来，能来吗？",
          a: "能。Demo 是可选的，来听的人永远比讲的人多。真正的门槛只有一个：你得对这件事有真兴趣，不是来发名片的。",
        },
        {
          q: "需要会写代码吗？",
          a: "不需要。用 AI 做出来的东西不一定是代码——一条内容流水线、一个自动化工作流、一套提示词，都算。",
        },
        {
          q: "讲中文还是英文？",
          a: "现阶段以中文为主。人多起来之后会开英文场，那时候两边都跑。",
        },
        {
          q: "具体在哪？",
          a: "报名后发给你。场地按当周人数定，在悉尼 CBD 范围内，公共交通直达。",
        },
        {
          q: "要钱吗？",
          a: "不要，各自买单。也不接「花钱换讲话时间」那种赞助——台上的时间靠做出东西来换，不靠掏钱换。将来如果有人白提供场地、不要求宣讲时间，那是另一回事。",
        },
        {
          q: "你自己从这个活动里图什么？",
          a: "不装。我自己也在做产品、也在做内容（抖音、公众号）。这个局对我不是纯公益——我在这里认识人、拿真实反馈，偶尔也会提我在做的东西。规则对我和对你完全一样：在自己的时段里讲，不在别人的时间里插播。真到了我要卖什么东西那天，我会直接说这是在卖，不会包装成分享。",
        },
        {
          q: "我能在这里推我自己的产品吗？",
          a: "能，而且这本来就是形式的一部分——demo 就是宣发。找用户、找合伙人、找反馈，在你的 5 分钟和「求助 & 需求」那一段说。唯一的界线是：别人在讲的时候，那是别人的时间。",
        },
        {
          q: "为什么是上午？下午不是更松吗？",
          a: "下午三点正好撞小学放学，家里有孩子的一律来不了。上午还顺带解决一个实际问题：悉尼 CBD 不少咖啡厅下午三四点就打烊，上午反而好占位子。",
        },
        {
          q: "我这周来不了，下周还能来吗？",
          a: "当然。它每周都在，不用连着来。来了就是自己人。",
        },
      ],
    },

    contact: {
      eyebrow: "§ 07 — 联系",
      title: "找不到人？加我微信。",
      lede: "场地临时变动、来之前想先问点什么、或者当天在楼下迷路了——扫码直接找我，比发邮件快。",
      caption: "微信扫码加我",
      alt: "James 的微信二维码",
    },

    footer: {
      tagline: "每周四见。",
      location: "悉尼 CBD · 每周四 10:00–13:00",
    },
  },

  en: {
    htmlLang: "en-AU",
    langSwitchLabel: "中文",
    langSwitchHref: "/?lang=zh",

    meta: {
      title: "Vibe Thursday · Sydney's weekly AI meetup",
      description:
        "Every Thursday morning in Sydney CBD. Bring whatever you built with AI and show it in five minutes. Broken demos welcome. Free.",
    },

    nav: {
      brand: "Vibe Thursday",
      cta: "Sign up",
    },

    hero: {
      eyebrow: "SYDNEY · EVERY THURSDAY",
      title: "Vibe Thursday",
      subtitle: "Sydney · every Thursday morning",
      lede: "Bring whatever you made with AI — a site, a script, an automation, a video tool, or an idea that does not work yet. Five minutes, to a room that gets it.",
      facts: [
        { label: "When", value: "Thursdays, 10am–1pm" },
        { label: "Where", value: "Sydney CBD" },
        { label: "Cost", value: "Free, buy your own coffee" },
      ],
      cta: "Sign up for the next one",
      ctaSecondary: "What is this?",
      note: "We carry on over lunch from noon. On school pickup, or need to get back to work? Leave at twelve.",
    },

    what: {
      eyebrow: "§ 01 — What this is",
      title: "A group of people around one table every Thursday morning, showing each other what they built with AI.",
      lede: "Borrowed from the weekly Thursday meetups in Beijing's Zhongguancun. Sydney already has plenty of monthly evening events, but nothing weekly in daylight — a monthly event is a calendar entry, a weekly one becomes a habit.",
      points: [
        {
          title: "Not a lecture",
          body: "No keynote, no status-report slides, no stage. Laptops get passed around and you interrupt with questions.",
        },
        {
          title: "Broken demos welcome",
          body: "The thing that does not work is usually the more interesting conversation. Nobody is grading polish here.",
        },
        {
          title: "Show, don't sell",
          body: "What you built is your best marketing — show it properly. Just don't turn someone else's turn into your pitch. Recruiters working the room, agencies hunting clients, people collecting contacts and leaving: not welcome.",
        },
      ],
    },

    who: {
      eyebrow: "§ 02 — Who it is for",
      title: "Anyone actually building with AI, or seriously about to start.",
      groups: [
        "Indie developers",
        "Founders working on their own product",
        "Freelancers and digital nomads",
        "Engineers curious about AI",
        "Team leads trying to get AI into real workflows",
        "Creators and writers covering AI",
      ],
      note: "A weekday morning is the filter. People who can show up at 10am on a Thursday have usually already made AI work for them — that is the group we want in the room first.",
    },

    schedule: {
      eyebrow: "§ 03 — Run of show",
      title: "Same rhythm every week.",
      slots: [
        {
          time: "10:00–10:30am",
          title: "Arrive · one-line intros",
          note: "Three things: your name, what you are building, what you are stuck on.",
        },
        {
          time: "10:30–11:30am",
          title: "Demo round",
          note: "Three slots max, five minutes each, hard timer. Tick the box when you sign up.",
        },
        {
          time: "11:30am–12:00pm",
          title: "Open time · blockers & asks",
          note: "One line each: what you are stuck on, and what you are looking for — users, a cofounder, feedback, a job. Anything you want to promote goes here.",
        },
        {
          time: "From 12:00pm",
          title: "Optional lunch",
          note: "Entirely optional. Stay if you want to keep talking, leave at twelve if you do not.",
        },
      ],
    },

    rules: {
      eyebrow: "§ 04 — House rules",
      title: "All five of them.",
      items: [
        "It runs even if two people show up. Cancel a weekly once and it dies.",
        "Same time, same place, every week. The venue does not rotate.",
        "Free, no tickets. Signing up is only so we know how many chairs.",
        "Demos are always optional. Show something or just listen.",
        "Show, don't sell. What you built is your marketing — present it properly in your own slot, just never over someone else's. People here only to harvest contacts or hunt will be asked to leave.",
      ],
    },

    signup: {
      eyebrow: "§ 05 — Sign up",
      title: "Sign up and I will send you the address.",
      lede: "The venue follows the headcount — a big table at a cafe when we are small, a room with a screen once we are not. So signing up genuinely helps me book the right thing.",
      fields: {
        name: "What should I call you",
        namePlaceholder: "Real name or handle, either is fine",
        email: "Email",
        emailPlaceholder: "you@example.com",
        emailRequired: true,
        wechat: "WeChat ID",
        wechatPlaceholder: "Optional",
        wechatRequired: false,
        wechatHint: "Announcements currently go through a WeChat group. Leave it and I will add you.",
        contactPrivacy: "Both fields are visible only to me, the organiser. Never published, never passed to anyone else, never used for marketing.",
        building: "What are you working on?",
        buildingPlaceholder: "A product, a side project, or just what you have been learning. A sentence or two is plenty.",
        demoIntent: "Want to demo this time?",
        demoOptions: [
          { value: "yes", label: "Yes" },
          { value: "maybe", label: "Maybe" },
          { value: "listen", label: "Just listening" },
        ],
        session: "Which session are you coming to?",
        source: "How did you hear about this?",
        sourcePlaceholder: "Optional",
      },
      submit: "Sign up",
      submitting: "Sending…",
      successTitle: "Got it.",
      successBody: "The address and a reminder will land in your inbox. If you left a WeChat ID I will add you to the group too.",
      errorGeneric: "That did not go through. Give it a moment and try again, or scan the WeChat code below.",
      errorRobot: "The bot check did not pass. Reload the page and try again.",
      errorRequired: "Name and email are required.",
      errorNeedContact: "Leave at least one way to reach you — email or WeChat.",
      errorEmail: "That email address does not look right.",
    },

    faq: {
      eyebrow: "§ 06 — Questions",
      title: "The ones people ask first.",
      items: [
        {
          q: "I have not built anything yet. Can I come?",
          a: "Yes. Demos are optional and there are always more listeners than presenters. The only real bar is genuine interest — this is not a networking room.",
        },
        {
          q: "Do I need to code?",
          a: "No. What you made with AI does not have to be code — a content pipeline, an automation, a prompt system all count.",
        },
        {
          q: "What language is it in?",
          a: "Mostly Mandarin right now. English sessions start once the group is big enough to run both.",
        },
        {
          q: "Where exactly?",
          a: "Sent after you sign up. Always in Sydney CBD, always reachable by public transport.",
        },
        {
          q: "Does it cost anything?",
          a: "No, everyone pays their own way. No pay-for-stage-time sponsorship either — floor time is earned by building something, not bought. Someone offering a room with no strings attached is a different question.",
        },
        {
          q: "What do you get out of running this?",
          a: "I am not going to pretend otherwise: I build products and I make content, and this is not pure charity for me. I meet people here, I get real feedback, and occasionally I will mention what I am working on. The rule applies to me exactly as it does to you — in my own slot, never over someone else's. And if I ever start selling something, I will say plainly that I am selling, not dress it up as sharing.",
        },
        {
          q: "Can I promote my own product here?",
          a: "Yes — that is the format, not a loophole. A demo is marketing. Looking for users, a cofounder, or feedback belongs in your five minutes and in the blockers & asks slot. The only line is that while someone else is talking, that time is theirs.",
        },
        {
          q: "Why mornings, not afternoons?",
          a: "3pm collides with school pickup, which rules out anyone with kids. Mornings also fix a practical problem: plenty of Sydney CBD cafes shut by mid-afternoon.",
        },
        {
          q: "I cannot make this week. Can I come next week?",
          a: "Of course. It runs every week and you do not need a streak.",
        },
      ],
    },

    contact: {
      eyebrow: "§ 07 — Contact",
      title: "Can't find us? Add me on WeChat.",
      lede: "Venue changes, questions before you come, or you're lost downstairs on the day — scan and message me directly. Faster than email.",
      caption: "Scan with WeChat",
      alt: "James's WeChat QR code",
    },

    footer: {
      tagline: "See you Thursday.",
      location: "Sydney CBD · Thursdays 10am–1pm",
    },
  },
} as const;

export type Copy = (typeof copy)[Lang];
