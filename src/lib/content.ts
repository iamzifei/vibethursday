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
        "每周四上午，悉尼 CBD。带上你用 AI 做的任何东西，5 分钟讲给一屋子懂的人听。没做完的、还在想的，都能讲。免费。",
    },

    nav: {
      brand: "Vibe Thursday",
      cta: "报名",
    },

    hero: {
      eyebrow: "SYDNEY · EVERY THURSDAY",
      title: "Vibe Thursday",
      subtitle: "悉尼 · 每周四上午的 AI 局",
      lede: "带上你用 AI 做出来的任何东西——一个产品、一条自动化流程、一套选题或剪辑的流水线、一个投放打法、一套提示词，甚至一个还没跑通的想法。5 分钟，讲给一屋子听得懂的人。",
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
      lede: "灵感来自北京中关村的每周四聚会。核心不是谁讲得好，是在悉尼找到一群同频的人——每周同一时间、同一地点，来的次数多了，它就成了你自己的圈子。",
      points: [
        {
          title: "不是讲座",
          body: "没有主讲嘉宾，没有汇报型 PPT，没有台上台下。笔记本传着看，随时打断提问。",
        },
        {
          title: "不用做完，也不用是产品",
          body: "做了一半的东西、一条内容、一个还在琢磨的想法，都能拿出来讲。这里不评判完成度——半成品反而更容易聊出东西来。",
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
        "AI 初创公司的创始人和团队",
        "做 AI 内容的：自媒体、公众号、播客、短视频",
        "自由职业 / 数字游民",
        "公司里的工程师、产品、设计、运营",
        "带团队、想把 AI 落到流程里的中层",
      ],
      note: "「做东西」不限于软件——一条内容流水线、一个自动化工作流、一套提示词、一个投放打法，都算。不用等做完，也不用做得好。",
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
          note: "最多 3 个名额，每人 5 分钟，硬计时。讲什么都行：产品、内容、一段流程，或者只是最近在想的事。想讲在报名时勾一下。",
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
        "只来两个人也照办。",
        "时间雷打不动，每周四同一时段。场地固定在悉尼 CBD，只有人数坐不下时才换——换了会提前说，不会每周换来换去。",
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
          q: "我能在这里推我自己的产品吗？",
          a: "能，这本来就是形式的一部分——demo 就是宣发。找用户、找合伙人、找反馈，在你的 5 分钟和「求助 & 需求」那一段说。唯一的界线是：别人在讲的时候，那是别人的时间。这条对所有人一样，包括我。",
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
        "Every Thursday morning in Sydney CBD. Bring whatever you built with AI and show it in five minutes. Unfinished and still-just-an-idea both count. Free.",
    },

    nav: {
      brand: "Vibe Thursday",
      cta: "Sign up",
    },

    hero: {
      eyebrow: "SYDNEY · EVERY THURSDAY",
      title: "Vibe Thursday",
      subtitle: "Sydney · every Thursday morning",
      lede: "Bring whatever you made with AI — a product, an automation, a content or editing pipeline, an ad playbook, a prompt system, or an idea that does not work yet. Five minutes, to a room that gets it.",
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
      lede: "Borrowed from the weekly Thursday meetups in Beijing's Zhongguancun. The point is not who presents best — it is finding people on your wavelength in Sydney. Same time, same place, every week; come often enough and it becomes your circle.",
      points: [
        {
          title: "Not a lecture",
          body: "No keynote, no status-report slides, no stage. Laptops get passed around and you interrupt with questions.",
        },
        {
          title: "Unfinished is fine",
          body: "It does not have to be a working product. Something half-built, a piece of content, an idea you are still turning over — all of it is worth five minutes. Nobody is grading how finished it is."
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
        "AI startup founders and their teams",
        "Creators: newsletters, podcasts, video, social",
        "Freelancers and digital nomads",
        "Engineers, PMs, designers, marketers",
        "Team leads getting AI into real workflows",
      ],
      note: "\"Building\" is not limited to software — a content pipeline, an automation, a prompt system, an ad playbook all count. It does not have to be finished, and it does not have to be good.",
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
          note: "Three slots max, five minutes each, hard timer. Anything goes: a product, a piece of content, a workflow, or just what you have been thinking about. Tick the box when you sign up.",
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
        "It runs even if two people show up.",
        "The time never moves. The venue stays in Sydney CBD and only changes when we outgrow it — announced in advance, never week to week.",
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
          q: "Can I promote my own product here?",
          a: "Yes — that is the format, not a loophole. A demo is marketing. Looking for users, a cofounder, or feedback belongs in your five minutes and in the blockers & asks slot. The only line is that while someone else is talking, that time is theirs. That applies to everyone, me included.",
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
