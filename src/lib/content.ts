/**
 * All user-facing copy, in both written languages.
 *
 * The community starts Chinese-first and goes bilingual once it outgrows a
 * single table, so Chinese is the default and English is a peer translation
 * rather than an afterthought. Keeping both in one shaped object means the
 * page components never branch on language — they just read `getCopy(lang)`.
 *
 * There is a third language on the site and it is deliberately not a third
 * block here: Traditional Chinese is derived from the Simplified copy by
 * `getCopy` at the bottom of this file.
 */

// Relative, not "@/": `pnpm test` loads this file through Node's type
// stripper, which does not read tsconfig's path aliases.
import { deepTranslate } from "./traditional.ts";

/**
 * The three views of this site.
 *
 * Only two of them are written. `zh-Hant` is `zh` put through a character
 * converter at render time — see `@/lib/traditional` for why, and note that it
 * means everything below stays a two-language object.
 */
export type Lang = "zh" | "zh-Hant" | "en";

export const LANGS: Lang[] = ["zh", "zh-Hant", "en"];

/** The `?lang=` value for each. Simplified is the default and carries none. */
export const LANG_PARAM: Record<Lang, string | null> = {
  zh: null,
  "zh-Hant": "zh-Hant",
  en: "en",
};

/** What each calls itself, short enough for the switch in the nav bar. */
export const LANG_LABEL: Record<Lang, string> = {
  zh: "简",
  "zh-Hant": "繁",
  en: "EN",
};

/** The full name, for the switch's accessible labels. */
export const LANG_NAME: Record<Lang, string> = {
  zh: "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
};

export function resolveLang(value: string | undefined): Lang {
  // Case-insensitive: a link pasted into WeChat comes back lowercased often
  // enough that "zh-hant" has to mean the same thing as "zh-Hant".
  const normalised = value?.toLowerCase();

  if (normalised === "en") return "en";
  if (normalised === "zh-hant") return "zh-Hant";

  return "zh";
}

export const copy = {
  zh: {
    htmlLang: "zh-CN",
    meta: {
      title: "Vibe Thursday · 悉尼每周四的 AI 局",
      description:
        "每周四上午，悉尼 CBD。一群在做东西的人围一张桌子，聊各自在用 AI 干什么、卡在哪。想给大家看点东西可以，只来听也完全没问题。免费。",
    },

    nav: {
      brand: "Vibe Thursday",
      cta: "报名",
      members: "成员",
      wharf: "码头",
      works: "作品",
      sessions: "场次",
      about: "这是什么",
      schedule: "流程",
      support: "开销",
      // Label for the phone menu button and for the two <nav> landmarks, which
      // is all a screen reader gets — the button itself is an icon.
      menu: "菜单",
      // The skip link. Hidden until it has focus; the first stop on the page.
      skip: "跳到正文",
      // Names the 简/繁/EN group for a screen reader.
      language: "语言",
    },

    hero: {
      eyebrow: "SYDNEY · EVERY THURSDAY",
      title: "Vibe Thursday",
      subtitle: "悉尼 · 每周四上午的 AI 局",
      lede: "一群在做东西的人围一张桌子喝咖啡，聊各自在用 AI 干什么、卡在哪。手上有东西想给大家看，随时可以；只想听，也完全没问题。产品、自动化流程、内容流水线、投放打法、提示词，甚至还没跑通的想法，都算。",
      facts: [
        { label: "时间", value: "每周四 10:00 开门 · 10:30 开始", href: null, linkLabel: null },
        // Fixed for the next few sessions, so the address belongs on the
        // first screen rather than in a message the day before.
        {
          label: "地点",
          value: "Vogue Cafe · 达令港",
          href: "https://maps.google.com/?q=Vogue+Cafe+Retail+5,+35+Wheat+Road,+Darling+Harbour+NSW+2000",
          linkLabel: "Retail 5, 35 Wheat Road, Darling Harbour →",
        },
        // This card is already asking "what does it cost", so it is the one
        // place the cost page can be linked without adding any weight to the
        // ask itself — maximum exposure, unchanged centre of gravity.
        {
          label: "费用",
          value: "免费，店里点杯喝的就行",
          href: "/support",
          linkLabel: "这活动本身的开销 →",
        },
      ],
      nextPrefix: "下一场 ",
      cta: "报名下一场",
      ctaSecondary: "先看看是什么",
      note: "12:00 之后自愿留下吃个午饭。赶着接娃或者要回去干活的，12 点直接走就行。",
    },

    what: {
      eyebrow: "§ 01 — 这是什么",
      title: "一句话：每周四上午，一群人围一张桌子，看彼此用 AI 做了什么。",
      lede: "灵感来自北京中关村的每周四聚会。核心不是谁讲得好，是在悉尼找到一群同频的人。每周同一时间、同一地点，来的次数多了，它就成了你自己的圈子。首场在 2026 年 8 月 6 日跑完，报名二十六个、到场十八九个，从独立开发者到律师、会计、企业主都有。",
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
      eyebrow: "§ 03 — 谁适合来",
      title: "只要你真的在用 AI 做点什么，或者真的想开始。",
      groups: [
        "独立开发者",
        "AI 初创公司的创始人和团队",
        "做 AI 内容的：自媒体、公众号、播客、短视频",
        "自由职业 / 数字游民",
        "公司里的工程师、产品、设计、运营",
        "带团队、想把 AI 落到流程里的中层",
        // 首场实际来得最多、聊得最深的一类人，之前这张单子上没有。
        "律师、会计、政府补贴与合规、市场——服务这些行业的，或者在用 AI 改造它们的",
      ],
      note: "「做东西」不限于软件——一条内容流水线、一个自动化工作流、一套提示词、一个投放打法，都算。不用等做完，也不用做得好。",
    },

    schedule: {
      eyebrow: "§ 07 — 流程",
      title: "每周同一个节奏，不变。",
      slots: [
        {
          time: "10:00–10:30",
          title: "开门 · 点杯喝的 · 随便聊",
          note: "不急着开场。场地在二楼，上楼前先把饮料点了——中途服务员进来问单会打断正在说话的人。晚到不会错过什么。",
        },
        {
          time: "10:30–10:40",
          title: "只有新朋友做个自我介绍",
          note: "45 秒，三件事：怎么称呼、在做什么、今天想拿走什么。来过的人不用再讲一遍——三十个人轮一圈要半小时，而且谁也记不住三十个人。",
        },
        {
          time: "10:40–11:50",
          title: "小桌",
          note: "分 3–4 桌，每桌一个话题或一个产品。随时串桌，想听哪个去哪个——不用等到聊不下去才走，走开不用打招呼也不用说再见，这个形式本来就该这么用。",
        },
        {
          time: "12:00 之后",
          title: "接着聊 · 午饭",
          note: "不强制。想接着聊的一起走，赶时间的 12 点就走。上一场散场后又聊了一个多小时，那一段往往是最好的。",
        },
      ],
    },

    gallery: {
      eyebrow: "§ 06 — 现场",
      title: "每一场都留了几张。",
      lede: "为保护参与者，认得出的人脸都遮掉了。点开某一场就能看到那天的全部照片。",
      archiveCta: "每一场的完整记录",
      // 新增一场：往下面加一条即可，页面按 date 倒序排、最新的默认展开。
      sessions: [
        {
          date: "2026-08-06",
          title: "第一场",
          note: "报名二十六个，到场十八九个，从独立开发者到律师、会计、企业主都有。",
          photos: [
            { src: "/photos/session-01-1", alt: "首场现场，一张长桌坐满了人", width: 1200, height: 900 },
            { src: "/photos/session-01-2", alt: "临着达令港的一侧，有人在讲自己在做的东西", width: 1200, height: 900 },
            { src: "/photos/session-01-3", alt: "另一个角度的现场", width: 1200, height: 900 },
            { src: "/photos/session-01-4", alt: "开场之前的场地", width: 1200, height: 900 },
          ],
        },
        {
          date: "2026-08-13",
          title: "第二场",
          note: "报名三十五个，到场三十来个。散场之后大家在楼下又聊了一个多小时，留下吃饭的聊到下午。",
          photos: [
            { src: "/photos/session-02-1", alt: "开场之前的场地，长桌沿着落地窗摆开，窗外是达令港", width: 1600, height: 900 },
            { src: "/photos/session-02-2", alt: "第二场现场，三十来个人围着长桌，靠窗一整排", width: 1600, height: 903 },
            { src: "/photos/session-02-3", alt: "桌上的果盘，一整排人沿着长桌坐开", width: 978, height: 1304 },
            { src: "/photos/session-02-4", alt: "桌上的咖啡、可颂和一支白玫瑰", width: 1200, height: 1600 },
          ],
        },
        {
          date: "2026-08-20",
          title: "第三场",
          note: "报名二十一个，到场二十出头。这一场分了四张桌子——增长与商业、To B、To C、AI 实操，进门自己挑一桌坐下，想去的那桌坐满了就换一桌。",
          photos: [
            { src: "/photos/session-03-1", alt: "桌上的果盘、面包和一支白玫瑰，背景里有人在聊天", width: 1448, height: 1086 },
            { src: "/photos/session-03-2", alt: "第三场现场，长桌两侧坐满了人，尽头有人站着讲话", width: 1600, height: 900 },
            { src: "/photos/session-03-3", alt: "另一个角度的长桌，窗外是达令港", width: 1600, height: 900 },
            { src: "/photos/session-03-4", alt: "从长桌另一头看过去，一整排人沿着窗坐开", width: 1600, height: 900 },
            { src: "/photos/session-03-5", alt: "长桌尽头，两个人站在吧台边上说话", width: 1600, height: 900 },
            { src: "/photos/session-03-6", alt: "散场前后，有人还坐着聊，有人站在吧台边上", width: 1600, height: 900 },
          ],
        },
        {
          date: "2026-08-27",
          title: "第四场",
          note: "报名二十个，到场十八个。开场三个人讲了自己在做的东西——一个是做了几个 App、卡在增长，一个把自己的 agency 换成了一批 agent。之后分四桌，散场后十五个人一起去吃了午饭。",
          photos: [
            { src: "/photos/session-04-1", alt: "十点半前后，人陆续进来，背景是还没坐满的桌子", width: 1600, height: 900 },
            { src: "/photos/session-04-2", alt: "长桌沿着落地窗摆开，窗外是达令港，有人已经在角落聊上了", width: 1600, height: 900 },
            { src: "/photos/session-04-3", alt: "另一个角度的同一片场地，靠窗一排陆续坐下", width: 1600, height: 900 },
            { src: "/photos/session-04-4", alt: "角落的卡座，几个人围着一台笔记本", width: 1600, height: 900 },
            { src: "/photos/session-04-5", alt: "开场前站着聊的一群人，旁边桌上摊着两台电脑", width: 1600, height: 900 },
          ],
        },
      ],
      photoCount: (n: number) => `${n} 张`,
    },

    // Sits on the home page between the photos and the house rules: by that
    // point the reader knows what the room is, and "who is in it" is the next
    // thing they want.
    membersTeaser: {
      eyebrow: "§ 02 — 会遇到谁",
      title: "你去了会遇到谁。",
      lede: "每个来过的人都有一张自己的名片：在做的产品、公司业务、自媒体账号、社群，或者只写一句「想找什么」。卡上最管用的是「想找什么」和「能帮什么」这两栏——找合伙人、找第一批用户、找踩过同一个坑的人，多半是从这两栏接上的。没有产品也一样有名片，这个局里听的人本来就比讲的人多。",
      cta: "看成员墙",
      ctaSecondary: "认领我的名片",
    },

    // § 03。位置是刻意的：紧挨着成员墙，因为这两样是这个站唯一会随时间变厚的
    // 东西。其余每一节讲的都是「周四会发生什么」，只有这两节讲的是「已经攒下了什么」。
    wharfTeaser: {
      eyebrow: "§ 04 — 大家想问什么",
      title: "周四之前，先知道谁在问什么。",
      lede: "报名时写的那句「最想问什么」会挂到码头上。看到你答得上来的，周四找他聊十分钟就完了——不用等到现场再从头认人。",
      cta: "去码头看看",
      // 只在有内容时出现。数字由页面算，不写死。
      count: "本周 {n} 个问题",
      empty: "这周还没有人挂问题上去。",
    },

    // § 05。放在「大家想问什么」后面：那两节从相反的两端回答同一个疑问——
    // 这些人想要什么，以及他们真的做完过什么。
    worksTeaser: {
      eyebrow: "§ 05 — 做出来的东西",
      title: "这屋子做出来的东西。",
      lede: "十来个产品，一半已经上线或者有收入，也有还只在自己电脑上跑的。全部来自成员墙上的卡片——卡在某个地方往往比已经上线更有的聊。",
      cta: "看大家做的东西",
    },

    rules: {
      eyebrow: "§ 08 — 几条规矩",
      title: "就这五条。",
      items: [
        "只来两个人也照办。",
        "时间雷打不动，每周四上午同一时段。接下来几场固定在达令港的 Vogue Cafe（地址在首屏），走路到 Town Hall 或 Darling Harbour 都很近。万一临时换场地，前一天发在群里。",
        "免费，不售票。报名只是为了估人数。",
        "开一桌永远是可选的。想开就开，不想开就串桌听，只来听的人一样欢迎。",
        "展示可以，插播不行。你做的东西就是你的宣发，在自己那一桌大方讲；别人那一桌不是你的场子。只来收名单、抓人、拉客的，会被请出去。",
      ],
    },

    signup: {
      eyebrow: "§ 09 — 报名",
      title: "报个名，我把地址发给你。",
      lede: "场地按当周人数定，报名人数直接决定我跟店里怎么订位子，所以这一步对我是真有用的。",
      // Shown instead of the identity fields when this browser has signed up
      // before, so a regular only picks a session.
      returning: {
        // {name} is substituted in the client component. Must not be a
        // function: this object is passed from a Server Component into a
        // Client Component, and functions cannot cross that boundary.
        hello: "{name}，欢迎回来。选个场次就行，其余的我这儿都有。",
        notYou: "不是我，或者要改资料",
      },
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
        topic: "这周最想聊什么、或者最想问什么",
        topicPlaceholder: "想找会 iOS 的合伙人 / 想搞懂 R&D 税务抵免怎么申报 / 想看看别人的 AI 工作流",
        // 这里刻意不再以「完全选填」开头。前 49 份报名里只有 3 个人填了这栏，
        // 而它是唯一能提前知道大家想要什么的入口——先说清楚它有什么用，
        // 退路留在最后一句。
        topicHint:
          "一句话就够。这是现场最容易帮到你的一句——说得越具体，越可能有人当场接上。它会显示在你成员卡片的「本周想聊」，每周都可以改。想不到就先空着。",
        // 08-13 有人反馈：来之前翻过成员墙，对几个人先有了印象，但墙上只有一部分人，
        // 剩下的还得现场花时间聊，聊完才发现不相关。当天实测 56 份报名只有 14 张卡在墙上——
        // 缺的不是意愿，是「认领 + 发布」两道闸。这个勾选把两道闸压成一个明示的同意。
        publishCard: "把上面这些放到成员墙上",
        publishCardHint:
          "勾了的话，你的名字、在做什么、这周想聊什么会出现在 vibethursday.com/members，别人来之前就能知道你是谁、要不要找你聊。邮箱和微信号永远不会出现在上面。随时可以改，也可以撤下来。",
        contactPrivacy: "这两栏只有我（活动组织者）看得到。不公开、不给第三方、不拿去发广告，也不会有人拿它加你推销。",
        building: "你在做什么？",
        buildingPlaceholder: "在做的产品、在折腾的东西、或者只是最近在学什么。一两句就够。",
        // 「开一桌」不是「demo」：小桌制下开桌门槛低到「有一个问题」就够，
        // 而 demo 这个词会让人以为要有做完的东西可展示。选项的存储值仍是
        // yes/maybe/listen —— signup-stats.ts 与 /admin 按它统计，不能动。
        demoIntent: "这次想开一桌吗？",
        demoOptions: [
          { value: "yes", label: "想开一桌" },
          { value: "maybe", label: "也许" },
          { value: "listen", label: "先来听听" },
        ],
        demoIntentHint:
          "门槛很低：不用做完，不用准备幻灯片，做了一半卡住的反而最好聊。手上没产品也行，一个问题就能开一桌。",
        session: "打算参加哪一场？",
        // Appended to every option. The dropdown is what people actually
        // read when choosing, and a date alone lets someone who works
        // weekday mornings pick one without ever noticing the time.
        sessionTimeSuffix: "上午 10:00",
        // Without this option someone who works Thursdays has two choices:
        // pick a date they will not attend, or close the page. The first
        // corrupts the headcount the table is booked against; the second is
        // the person lost. Listed last so the default stays a real session.
        sessionNone: "上午都来不了（想要下班后或周末的场）",
        sessionNoneHint:
          "周四上午上班来不了的话，选这个就行——一样算登记，以后要是开周末或者晚上的场，我按这份名单来找人。",
        // Asked of everyone, not just the people who picked "none". Whether a
        // second session is worth running depends on total demand, and a
        // Thursday regular who would also come on a Saturday is part of that.
        availability: "除了周四上午，你还能来什么时间？",
        availabilityHint: "选填，可多选。这是我决定要不要开第二场、开在什么时间的唯一依据——够多的人选同一个时间，那一场就开。",
        availabilityOptions: [
          { value: "weekday_evening", label: "工作日晚上" },
          { value: "weekend_day", label: "周末白天" },
          { value: "weekend_evening", label: "周末晚上" },
        ],
        // 表单末尾那一折的标题。里面三栏都是只对我有用、对填表的人没用的问题，
        // 所以默认收起来——它们不该给这张表增加长度。
        //
        // 标题写清楚里面装的是什么，而不是「更多选项」：看不见里面有什么的折叠
        // 区没人会去点开，这是折叠这个做法最常见的失败方式。
        extras: "再多问几个（都可跳过）：怎么知道这个活动的、平时用什么 AI",
        // 两栏关于 AI 用量的问题，都是选填，也都是给我看的、不是给填表的人看的：
        // 用来判断这屋子的技术密度，以及海外/国内模型各占多少。
        //
        // 之前 topic 那个文本框放末尾只有 49 份里 3 个人填，但那是要动脑写字的；
        // 这两栏是点一下的方块，和 availability 一样，不是同一件事。
        aiModels: "平时主要用哪些 AI？",
        aiModelsHint:
          "选填，可多选。我想知道这屋子里海外模型和国内模型各占多少——现场演示用什么、值不值得聊拼车订阅和国内 API，都看这个。",
        // 分成海外/国内两排，是因为这份统计最想要的就是这条线。选项的存储值
        // 自带 intl_ / cn_ 前缀，所以两边各有多少人可以直接从值上数出来，
        // 不需要在别处再维护一张「哪个模型算哪边」的对照表。
        aiModelGroups: [
          {
            label: "海外",
            options: [
              { value: "intl_openai", label: "ChatGPT / GPT" },
              { value: "intl_claude", label: "Claude" },
              { value: "intl_gemini", label: "Gemini" },
              { value: "intl_other", label: "其他海外（Grok、Llama…）" },
            ],
          },
          {
            label: "国内",
            options: [
              { value: "cn_deepseek", label: "DeepSeek" },
              { value: "cn_qwen", label: "通义千问 Qwen" },
              { value: "cn_kimi", label: "Kimi" },
              { value: "cn_doubao", label: "豆包" },
              { value: "cn_other", label: "其他国内（智谱、MiniMax…）" },
            ],
          },
        ],
        // 刻意不问「一个月烧多少 token」。真要答那个数得去翻三个后台的账单页，
        // 大多数人答不上来，于是这一栏就会空着。问花多少钱是同一件事的一个
        // 便宜代理：订阅和 API 的价钱是大家本来就记得的数。
        aiSpend: "每个月在 AI 上大概花多少？",
        aiSpendHint:
          "选填。不用去翻账单，下面哪条最像你就选哪条。问的是用得有多重，不是钱本身。按美元算。",
        // 下拉的第一项，也是默认项。空值＝没回答，跟没点开这一折是同一个结果。
        // 用下拉而不是五个单选方块，除了省掉四行高度，还顺手解决了单选点了
        // 取消不掉的问题——想反悔的人选回这一项就行。
        aiSpendSkip: "（跳过）",
        aiSpendOptions: [
          { value: "free", label: "只用免费的" },
          { value: "lt_50", label: "一两个订阅（50 以内）" },
          { value: "50_200", label: "订阅之外还调 API（50–200）" },
          { value: "200_1000", label: "API / agent 天天在跑（200–1000）" },
          { value: "gt_1000", label: "跑批量任务或带着团队用（1000 以上）" },
        ],
        source: "怎么知道这个活动的？",
        sourcePlaceholder: "选填",
      },
      // Sits under the form rather than inside it. Someone deciding whether to
      // come should see what the thing costs before they commit — but it must
      // never look like a step, or it stops being optional.
      supportNote: "活动免费，这条不变。场地每周会有最低消费或场地费，通常一两百澳元，目前我垫着——",
      supportNoteCta: "这活动的开销",
      supportNoteTail: "。想一起分摊的随意，不分摊照样来。",
      submit: "提交报名",
      submitting: "提交中…",
      successTitle: "收到了。",
      successBody: "地址和当周提醒会发到你的邮箱。留了微信号的话，我会另外拉你进群。",
      // The highest-intent screen on the site, and claiming a card needs exactly
      // the signup that was just created. Anywhere else this ask is a chore.
      successClaimBody: "顺手认领一下你的成员卡片吧——已经按你刚才填的内容预填好了，改两个字就能发布。当天还能直接当桌牌用。",
      successClaimCta: "认领我的名片",
      // A quiet second line, never a second button. The card feeds the member
      // wall — the only thing here that accumulates, and the page shown to
      // anyone considering coming — so two competing CTAs would cost more
      // there than they could win back in coffee money.
      successSupportBody: "另外，这个活动的场地费是我先垫的——",
      successSupportCta: "想搭把手的话看这儿",
      successSupportTail: "。不搭把手照样来。",
      errorGeneric: "提交失败了。稍等一下再试一次，或者直接扫码加我微信。",
      errorRobot: "人机验证没通过。刷新页面重试一次。",
      errorRequired: "名字和微信号是必填的。",
      errorNeedContact: "至少留一个联系方式，微信号或邮箱都行。",
      errorEmail: "这个邮箱地址看起来不太对。",
    },

    faq: {
      eyebrow: "§ 10 — 常见问题",
      title: "先回答几个大概率会问的。",
      items: [
        {
          q: "我什么都还没做出来，能来吗？",
          a: "能。开一桌是可选的，串桌听的人永远比开桌的人多。而且开桌的门槛也很低——不用做完，不用准备幻灯片，做了一半卡住的反而最好聊；手上没产品也行，一个问题就能开一桌。真正的门槛只有一个：你得对这件事有真兴趣，不是来发名片的。",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "需要会写代码吗？",
          a: "不需要。用 AI 做出来的东西不一定是代码——一条内容流水线、一个自动化工作流、一套提示词，都算。",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "讲中文还是英文？",
          a: "现阶段以中文为主，暂时也没有开英文场的计划。中文不是限制，是这个局能聊得深的原因——悉尼英文的 AI 聚会不缺，缺的是这个。以后真要开，那会是另外一场，不会把这场改成英文。",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "具体在哪？",
          a: "Vogue Cafe，Retail 5, 35 Wheat Road, Darling Harbour NSW 2000——达令港水边、W Sydney 楼下。接下来几场都在这儿。报名后我也会把地址再发你一次。",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "要钱吗？",
          a: "不要，不售票，也不会有会员费，这条不变。每人点一杯，咖啡、茶、饮料都行，不一定得是咖啡，各自买单。不过它不是零成本：场地会有最低消费或者场地费，每周不一样，通常一两百澳元，目前我先垫着。想搭把手的话，",
          href: "/support",
          linkLabel: "这儿有个入口",
          aTail: "；不搭把手照样来，也没人会知道谁给了谁没给。另外不接「花钱换讲话时间」那种赞助：台上的时间靠做出东西来换，不靠掏钱换。将来如果有人白提供场地、不要求宣讲时间，那是另一回事。",
        },
        {
          q: "我能在这里推我自己的产品吗？",
          a: "能，这本来就是形式的一部分，给大家看东西本身就是宣发。找用户、找合伙人、找反馈，写在你的成员卡上，或者干脆自己开一桌。唯一的界线是：别人那一桌不是你的场子。这条对所有人一样，包括我。",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "为什么是上午？下午不是更松吗？",
          a: "下午三点正好撞小学放学，家里有孩子的一律来不了。上午还顺带解决一个实际问题：悉尼 CBD 不少咖啡厅下午三四点就打烊，上午反而好占位子。上午上班来不了的话也别走——报名时把场次选成",
          href: "#signup",
          linkLabel: "「上午都来不了」",
          aTail: "，以后要是开晚上或者周末的场，我就按那份名单来找人。",
        },
        {
          q: "我这周来不了，下周还能来吗？",
          a: "当然。它每周都在，不用连着来。来了就是自己人。每次来之前",
          href: "#signup",
          linkLabel: "回来选个场次",
          aTail: "就行，我按人数订位子——第二次之后就是两下的事，资料都记着。",
        },
      ],
    },

    contact: {
      eyebrow: "§ 11 — 联系",
      title: "找不到人？加我微信。",
      lede: "场地临时变动、来之前想先问点什么、或者当天在楼下迷路了——扫码直接找我，比发邮件快。",
      caption: "微信扫码加我",
      alt: "James 的微信二维码",
    },

    // ── 开销 ──────────────────────────────────────────────────────────
    // 这一页的第一句必须是「免费」，不是「支持我们」。顺序反过来，
    // 它就从「成本透明」变成了「开始收费的第一步」——那正是要避免的读法。
    support: {
      meta: {
        title: "这个活动的开销 · Vibe Thursday",
        description:
          "活动免费，以后也免费。但它不是零成本——场地每周有最低消费或场地费，通常一两百澳元。想搭把手的话，入口在这儿。",
      },
      eyebrow: "§ 开销",
      title: "活动免费。但它不是零成本。",
      lede: "先把最要紧的说完：这个活动永远免费，没有门票，也不会有会员费。这一页不是在卖什么。",

      costTitle: "每周的开销",
      costItems: [
        {
          label: "场地",
          value: "一两百澳元",
          note: "有的场地收最低消费，有的收场地费，每周不一样，也跟来多少人没关系。通常在一两百澳元之间，个别场次会更高。",
        },
        {
          label: "你的那一杯",
          value: "各付各的",
          note: "场地那边的规矩是每人点一杯——咖啡、茶、气泡水、果汁都行，不一定得是咖啡。这跟上面那笔完全无关，各付各的。",
        },
      ],
      costNote:
        "这笔目前是我先垫的。不是垫不起，是没必要一个人扛着。",

      askTitle: "想一起分摊的话",
      askBody:
        "十块二十块都行，一次、偶尔、或者从来不给，都完全没关系。来的人里大多数不会给，这很正常，也不影响任何事。",
      askScaleNote:
        "给个参照：一场的场地大概是一两百澳元，到场二十来个人，也就是人均几块钱。不用多给，这不是筹款。",
      askOptIn:
        "想上「谁在一起撑着这件事」那份名单的话，付款留言里写个名字就行。不写就不上，我也不会问。",
      linkCta: "分摊一笔",

      thanksTitle: "谁在一起撑着这件事",
      thanksLede:
        "跟开源项目一样，contributor 从来不只是出钱的人：带朋友来的、上去讲过的、帮着张罗的，都在这儿。名单是自愿上的——想上就在转账留言里写个名字，不写就不上，没人会问。",
      thanksKinds: {
        money: "分摊过场地",
        demo: "讲过东西",
        brought: "带人来过",
        helped: "帮过忙",
      },
      thanksNote:
        "顺序就是先后，不是排名，也不记谁给了多少。没在这份名单上不代表任何事——大多数人本来就不会来登记。",

      rulesTitle: "三条不会变的",
      rules: [
        "不会有人因为没给而被看出来。谁给了、给了多少，我不会说；「谁在一起撑着这件事」那份名单是自愿上的——给了但不想上名单，跟从来没给过，在这一页上长得一模一样。",
        "给过钱不换来任何东西——不换讲话时间，不换排序，不换任何优待。台上的时间靠做出东西来换，这条对所有人一样，包括我。",
        "多出来的钱不退，滚到下一场，也留着应付场地涨价这类事。不够的我补。",
      ],

      back: "← 回首页",
    },

    footer: {
      tagline: "每周四见。",
      location: "达令港 Vogue Cafe · 每周四 10:00 开门，10:30 开始",
      supportLink: "这个活动的开销",
      // The label on the GitHub mark. It is never shown — the mark carries the
      // link — but it is what a screen reader announces, so it is translated
      // even though the slogan beside it is not.
      sourceLink: "在 GitHub 上看这个网站的源代码",
    },

    // ── 成员墙 ────────────────────────────────────────────────────────
    // 主语是「人」，不是「作品」。所有文案都要守住这一点：没有产品的人
    // 读到任何一句都不该觉得自己不该出现在这儿。
    members: {
      meta: {
        title: "成员 · Vibe Thursday",
        description:
          "来过 Vibe Thursday 的人，和他们在做的事。产品、公司业务、自媒体、社群，或者只是想聊的方向。",
      },
      eyebrow: "§ 成员",
      title: "来过的人，和他们在做的事。",
      lede: "以前这些都发在群里，翻两天就没了。现在它们在这儿。没有产品也可以有名片——「想找什么」比「做过什么」更有用。",
      claimCta: "认领我的名片",
      editCta: "编辑我的名片",
      thisWeek: "本周四会来",
      // 同一组，但墙正在回头看的时候用这个。周四中午一过，「下一场」就滚到
      // 下周，今天这批人会整组消失——而中午到下午恰恰是有人在想「刚才跟我
      // 聊的是谁」的时候。见 sessions.ts 的 sessionInFocus。
      lastSession: "上一场来了",
      everyone: "所有成员",
      // 用在「本周四会来」那组存在的时候。第二组装的是「其余的人」，
      // 管它叫「所有成员」是错的——本周那几位并不在里面。
      others: "其他成员",
      empty: "还没有人认领名片。你可以是第一个。",
      emptyFiltered: "这个筛选下还没有人。",
      countLabel: "{n} 位",
      attended: "出席 {n} 次",
      lookingFor: "想找",
      canHelp: "能帮",
      // 直接读报名表最近一次填的「这周想聊点什么」，成员自己不用动。
      thisWeekTopic: "本周想聊",
      // 同一栏，写在过去某一场的时候用这个。之前只有「本周想聊」一个标签，
      // 于是不是本周的就干脆不显示——结果整站大部分时间一句都不显示。
      topicOn: "{date}想聊",
      // 报名时选了「上午都来不了」的人，那句话不属于任何一场。
      topicUndated: "想聊",
      visit: "打开",
      back: "← 所有成员",
      filterAll: "全部",
      clearTag: "清除标签筛选",
      // 想不起名字是这面墙最常见的用法：聊得很好，散了场，脑子里只剩
      // 「那个做 SEO 的」。角色 chip 筛不出这种——它只有六个大类。
      // 所以搜索框搜的是自由文本那几栏，不是名字。
      searchLabel: "在成员里搜",
      searchPlaceholder: "想不起名字？搜他在做什么，比如「SEO」「投广告」",
      searchSubmit: "搜",
      searchClear: "清除搜索",
      searchEmpty: "没搜到「{q}」。换个词试试，或者他可能还没认领名片。",
      roles: {
        builder: "在做产品",
        business: "有公司 / 业务",
        advisor: "专业服务",
        creator: "做内容",
        organiser: "有社群",
        listener: "先来听",
      },
      kinds: {
        product: "产品",
        business: "业务",
        media: "自媒体",
        community: "社群",
        profile: "主页",
      },
      // 阶段是标签，不是门槛。「本地跑通」在一个 builders 的局里是完全
      // 合法的展示物——它意味着这人卡在某处，桌上可能就有人能接。
      stages: {
        idea: "💡 想法阶段",
        local: "🔧 本地跑通",
        beta: "🧪 内测中",
        live: "🚀 已上线",
        revenue: "💰 已有收入",
      },
      platforms: {
        xhs: "小红书",
        wechat: "公众号",
        x: "X",
        linkedin: "LinkedIn",
        youtube: "YouTube",
        podcast: "播客",
        github: "GitHub",
        substack: "Substack",
        other: "其他",
      },
    },

    /**
     * 码头 —— /wharf。
     *
     * 这一页没有任何新的输入框。它显示的是报名表上「这周最想聊什么、或者最想问
     * 什么」那一栏，四场下来填写率从 19% 涨到了 80%，而在这一页之前，那些句子
     * 几乎在站上看不见：成员卡只在本人报了「下一场」的时候才显示一句，所以上一场
     * 结束到下一周报名开始之间，整站一句都不显示。
     */
    wharf: {
      meta: {
        title: "码头 · Vibe Thursday",
        description:
          "来 Vibe Thursday 的人带着什么问题。报名时写的那句「最想问什么」都挂在这儿——周四之前就能知道该找谁聊。",
      },
      eyebrow: "§ 码头",
      title: "大家想问什么。",
      lede: "这儿挂的都是有人真的想问、但周四那 90 分钟不一定问得完的东西。看到你答得上来的，当天找他聊十分钟就完了。",
      // 原来这儿写的是「因为我们真的在码头上——35 Wheat Road, Darling Harbour」。
      // 删掉了：那句话把一个板块的名字焊死在一个地址上，而场地是会换的。
      // 名字得能自己站住，换成梗本身就够了。
      place: "去码头搞点薯条。",
      // 海鸥说的话。梗是「今天好无聊，去码头整点薯条」——而它描述的，
      // 正好是这一页最需要发生的那件事：答得上来的人，闲着的时候过来看一眼。
      // 所以它不是贴在旁边的笑话，它就是给答题者的那句召唤。
      //
      // 冷着说。这个站从头到尾没有一个感叹号，海鸥也不例外。
      say: {
        waiting: "今天好无聊…… 本周挂了 {n} 个问题",
        quiet: "本周还没人挂问题。往下翻，前几周的还在。",
        empty: "今天好无聊。",
      },
      thisWeek: "本周",
      // 报名时选了「上午都来不了」的人。他们照样能有名片、照样能写问题，
      // 而且这一页是他们唯一还会被看见的地方。
      noSession: "周四上午来不了的",
      comingLabel: "本周四会来",
      emptyWeek: "这一场还没有人挂问题上去。报名的时候写一句，它就会出现在这儿。",
      older: "更早的 {n} 场、{m} 个问题不在这一页上——它们还在各自的成员卡上。",
      langNote: "问题都是本人写的，原样放在这儿，一个字没改。",
      // 两张画的替代文本。写得具体一点：读屏的人拿不到画，但拿得到这句，
      // 而这两张画讲的是这一页的梗，不是装饰。
      // 四格漫画的台词。★ 它们是文字，不是画进图里的——图里的气泡是空的。
      // 这样中/繁/英三份都成立，能被选中、能被读屏念出来，也不用把别人的画
      // 整张搬过来。梗的原作是知乎上流传的那张两只海鸥的四格。
      strip: {
        // 第一格没有对话：两只鸟并排站着，看海。
        q1: "我们要飞向何方",
        a1: "我打算待会去码头搞点薯条",
        q2: "你误会我了伙计，我说的是咱们这一辈子的终极目标。归根结底，活着是为了什么",
        a2: "为了待会去码头搞点薯条",
      },
      gullAlt: "一只银鸥站在木栈道上，面无表情地盯着脚边掉的一根薯条。",
      panelAlt: [
        "两只银鸥并排站在码头的木栏上，望着海，谁也没说话。",
        "小的那只转过头去看大的那只，两只都张着嘴。",
        "大的那只的特写，嘴张着，眼神认真。",
        "小的那只的特写，嘴张着，一脸面无表情。",
      ],
      how: {
        title: "想让你的问题出现在这儿？",
        body: "报名的时候把「最想问什么」填了，并且勾上「把上面这些放到成员墙上」。就这两步，没有第三个地方要填。写得越具体越容易被接上——「怎么做增长」不如「做完的 app 只有自然量，第一批付费用户从哪儿找」。",
        cta: "去报名",
      },
      membersCta: "看成员墙",
    },

    /**
     * 场次存档 —— /sessions。
     *
     * 每一场是一个对象，而不是三个页面各知道一部分：照片在首页、问题在码头、
     * 人在成员墙（还是按最近出席排的）。在这一页之前，站上没有任何地方能回答
     * 「第三场那天发生了什么」。
     */
    archive: {
      meta: {
        title: "场次 · Vibe Thursday",
        description:
          "每一场 Vibe Thursday：那天的照片、那天大家想问什么、那天来了谁。",
      },
      eyebrow: "§ 场次",
      title: "每一场，和那天发生的事。",
      lede: "照片、那天挂在码头上的问题、那天来的人——之前它们在三个页面上，现在在一条线上。",
      totals: {
        sessions: "已办",
        sessionsUnit: "场",
        signups: "报过名",
        signupsUnit: "人",
        cards: "成员卡",
        cardsUnit: "张",
        questions: "码头问题",
        questionsUnit: "条",
      },
      // ⚠️ 这一句不是免责声明，是口径。报名和到场是两个可以差出好几个人的数，
      // 而这个站只量得到前一个——第四场就出现过没报名直接来、且是全场最受欢迎
      // 展示者的情况。每一场真实的到场人数写在那一场自己的那句话里。
      totalsNote: "「报过名」不是到场。每一场实际来了多少人，写在那一场下面那句话里。",
      questionsLabel: "那天挂在码头上的问题",
      // 一场十几条问题，四场排下来页面就长得没人往下翻了。前三条摊开，其余折起来。
      moreQuestions: "还有 {n} 条",
      morePhotos: "那天的另外 {n} 张",
      // 画出来的，不是拍的——但它是照着那天的照片画的，所以画的确实是那个房间。
      // alt 要把这两件事都说清楚，不然读屏的人要么以为是照片，要么以为是随便画的。
      posterAlt: "{title}的彩铅画，照着那天的照片画的：临水的咖啡馆，几张桌子围坐着人，窗外是达令港。画里的人都是背影。",
      peopleLabel: "那天来的（已经上墙的）",
      // 只数已发布的成员卡，所以它一定小于真实到场数，说清楚免得被当成人数。
      peopleNote: "只数了认领过名片的人，所以这个数比当天实际到场少。",
      empty: "这一场还没有人上墙。",
      photoAlt: "点开看这一场的照片",
      backToWharf: "去码头",
    },

    /**
     * 作品 —— /works。
     *
     * 成员墙的第二个视图，不是第二面墙：墙的主体是人，产品只是卡上能挂的
     * 五类东西之一，而「以产品为主体」这个模型早就被否掉了——会把只来听的
     * 那批人整个挡在外面。这一页只回答一个更窄的问题：来这儿的人做出了什么。
     */
    works: {
      meta: {
        title: "作品 · Vibe Thursday",
        description: "来 Vibe Thursday 的人做出来的东西。已上线的、还在内测的、只在自己电脑上跑的，都在这儿。",
      },
      eyebrow: "§ 作品",
      title: "这些人做出来的东西。",
      lede: "全部来自成员墙上的卡片。顺序跟墙一样——最近来过的在前面，不按做到哪一步排：卡在某个地方往往比已经上线更有的聊。",
      countLabel: "{n} 件",
      by: "来自",
      visit: "打开",
      all: "全部",
      empty: "这个阶段还没有东西。",
      emptyAll: "墙上还没有人挂产品。",
      wallCta: "看成员墙",
    },

    claim: {
      meta: {
        title: "认领名片 · Vibe Thursday",
        description: "报过名就能认领你的成员名片。",
      },
      eyebrow: "§ 认领",
      title: "认领你的名片",
      lede: "报过名就能认领。用报名时写的名字和微信号（或邮箱）对一下就行——资料已经按你当时写的内容预填好了，改两个字就能发布。",
      nameLabel: "报名时写的名字",
      namePlaceholder: "和报名表上一致",
      contactLabel: "微信号或邮箱",
      contactPlaceholder: "填哪个都行",
      privacy: "这两栏只用来找到你那条报名记录，不会出现在名片上，也不会公开。",
      submit: "认领",
      submitting: "查找中…",
      errorNotFound: "没找到对得上的报名记录。名字和联系方式都要和报名时填的一致，不确定的话在群里找我。",
      errorRequired: "两栏都要填。",
      errorGeneric: "出错了，稍等一下再试。",
      noSignupLead: "还没报过名？",
      noSignupCta: "先报名，下周四见",
    },

    editor: {
      meta: { title: "我的名片 · Vibe Thursday" },
      eyebrow: "§ 我的名片",
      title: "我的名片",
      lede: "下面这些是按你报名时写的内容预填的，改成你想让别人看到的样子。除了名字全都选填，留空就不显示。",
      draftNote: "还没发布，现在只有你自己看得到。",
      liveNote: "已经在成员墙上了。",
      viewCard: "看看公开的样子",
      backToWall: "← 成员墙",
      displayName: "名字",
      handle: "主页地址",
      handlePrefix: "/members/",
      handleHint: "只能用小写字母、数字和连字符。留空我给你生成一个。",
      headline: "一句话介绍",
      headlinePlaceholder: "你是谁、在做什么，一句话",
      bio: "多说两句",
      bioPlaceholder: "选填。背景、在折腾的方向、最近在想什么都行。",
      roles: "你是哪一种",
      rolesHint:
        "可以多选。做律师、会计、补贴、合规、市场这些的选「专业服务」，屋里正好有人在找你。「先来听」也是一种，选了不丢人——这个局里听的人本来就比讲的人多。",
      lookingFor: "🔎 想找什么",
      lookingForPlaceholder: "找会 iOS 的合伙人 / 想找第一批种子用户 / 想聊聊出海支付",
      canHelp: "🤝 能帮什么",
      canHelpPlaceholder: "投过三年 Google Ads / 悉尼注册公司踩过坑",
      matchHint: "这两栏是整面墙最有用的部分。别人是靠它找到你的，不是靠你的头衔。",
      tags: "标签",
      tagsPlaceholder: "AI Agent, 出海, 小红书",
      tagsHint: "逗号分隔，最多 6 个。中英文逗号都行。",
      tagsSuggest: "别人在用的：",
      assets: "你的东西",
      assetsHint:
        "产品、公司业务、自媒体账号、社群、个人主页，有几个加几个，最多 8 个。一个都没有也完全可以——名片照样成立。",
      addAsset: "＋ 加一个",
      removeAsset: "删掉",
      assetKind: "类型",
      assetTitle: "名称",
      assetTitlePlaceholder: "叫什么",
      assetTagline: "一句话",
      assetTaglinePlaceholder: "它是干嘛的",
      assetUrl: "链接",
      assetUrlPlaceholder: "选填",
      assetUrlHint: "还没上线、只在本地跑，链接空着就行，选个阶段反而更有话题。",
      assetStage: "阶段",
      assetPlatform: "平台",
      hidden: "暂时不公开",
      hiddenHint: "勾上之后名片从墙上撤下来，内容都还在，随时可以放回去。",
      saveDraft: "存草稿",
      publish: "发布到成员墙",
      update: "保存修改",
      saving: "保存中…",
      saved: "保存好了。",
      errorName: "名字不能空着。",
      errorSlug: "这个地址已经有人用了，换一个。",
      errorGeneric: "保存失败，稍等一下再试。",
      signOut: "退出",
      badgeCta: "把手机当桌牌",
      draftRestored: "恢复了你上次没保存完的修改。",
      draftDiscard: "丢弃，用已保存的版本",
      avatar: "头像",
      avatarUpload: "上传头像",
      avatarReplace: "换一张",
      avatarRemove: "去掉",
      avatarWorking: "处理中…",
      avatarHint: "会自动裁成正方形并压缩，只在你自己的卡片上显示。不传就用名字首字。",
      avatarFailed: "上传失败了，换张图或者换个浏览器再试。",
    },

    // 桌牌。首场复盘里记了一条：后到的人没写名牌，导致「不知道说话的人是谁」。
    // 手机立在桌上就解决了，不用印、不用笔、不用指定一个人管。
    badge: {
      meta: { title: "桌牌 · Vibe Thursday" },
      title: "把手机立在自己前面",
      lede: "横过来立在桌上就行。别人扫一下二维码，就能看到你的完整名片：在做什么、想找什么、能帮什么。",
      open: "打开桌牌",
      exit: "退出桌牌",
      scanHint: "扫一下看我的完整名片",
      draftWarning: "你的卡片还没发布，二维码现在扫不开。回去点一下「发布到成员墙」就行。",
      keepAwakeNote: "打开期间屏幕不会自动熄灭。",
      back: "← 我的名片",
      exportCta: "生成名片图（可发微信）",
      exportAgain: "重新生成",
      exporting: "生成中…",
      exportLongPress: "长按下面这张图，保存或直接转发。",
      exportAlt: "你的名片图，长按可保存",
      exportFailed: "生成失败了，换个浏览器再试一次。",
    },
  },

  en: {
    htmlLang: "en-AU",
    meta: {
      title: "Vibe Thursday · Sydney's weekly AI meetup",
      description:
        "Every Thursday morning in Sydney CBD. A table of people who build things, talking about what they are doing with AI and where they are stuck. Show something if you want to, or just listen. Free.",
    },

    nav: {
      brand: "Vibe Thursday",
      cta: "Sign up",
      members: "Members",
      wharf: "The Wharf",
      works: "Works",
      sessions: "Sessions",
      about: "What this is",
      schedule: "Run of show",
      support: "Costs",
      menu: "Menu",
      skip: "Skip to content",
      language: "Language",
    },

    hero: {
      eyebrow: "SYDNEY · EVERY THURSDAY",
      title: "Vibe Thursday",
      subtitle: "Sydney · every Thursday morning",
      lede: "A table of people who build things, over coffee, talking about what they are doing with AI and where they are stuck. Got something to show? Go ahead. Only want to listen? Also fine. A product, an automation, a content pipeline, an ad playbook, a prompt system, or an idea that does not work yet all count.",
      facts: [
        { label: "When", value: "Thursdays · doors 10am, starts 10:30am", href: null, linkLabel: null },
        {
          label: "Where",
          value: "Vogue Cafe · Darling Harbour",
          href: "https://maps.google.com/?q=Vogue+Cafe+Retail+5,+35+Wheat+Road,+Darling+Harbour+NSW+2000",
          linkLabel: "Retail 5, 35 Wheat Road, Darling Harbour →",
        },
        {
          label: "Cost",
          value: "Free, just order a drink",
          href: "/support",
          linkLabel: "What running it costs →",
        },
      ],
      nextPrefix: "Next · ",
      cta: "Sign up for the next one",
      ctaSecondary: "What is this?",
      note: "We carry on over lunch from noon. On school pickup, or need to get back to work? Leave at twelve.",
    },

    what: {
      eyebrow: "§ 01 — What this is",
      title: "A group of people around one table every Thursday morning, showing each other what they built with AI.",
      lede: "Borrowed from the weekly Thursday meetups in Beijing's Zhongguancun. The point is not who presents best, it is finding people on your wavelength in Sydney. Same time, same place, every week; come often enough and it becomes your circle. The first session ran on 6 August 2026: 26 signed up and 18 to 20 turned up, from indie developers to lawyers, accountants and business owners.",
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
      eyebrow: "§ 03 — Who it is for",
      title: "Anyone actually building with AI, or seriously about to start.",
      groups: [
        "Indie developers",
        "AI startup founders and their teams",
        "Creators: newsletters, podcasts, video, social",
        "Freelancers and digital nomads",
        "Engineers, PMs, designers, marketers",
        "Team leads getting AI into real workflows",
        "Lawyers, accountants, grant and compliance people — serving those fields, or rebuilding them with AI",
      ],
      note: "\"Building\" is not limited to software — a content pipeline, an automation, a prompt system, an ad playbook all count. It does not have to be finished, and it does not have to be good.",
    },

    schedule: {
      eyebrow: "§ 07 — Run of show",
      title: "Same rhythm every week.",
      slots: [
        {
          time: "10:00–10:30am",
          title: "Doors · order a drink · open chat",
          note: "No rush to start. We are upstairs, so order downstairs on your way up — a waiter taking orders mid-session cuts across whoever is talking. Arriving late costs you nothing.",
        },
        {
          time: "10:30–10:40am",
          title: "First-timers introduce themselves",
          note: "Forty-five seconds, three things: your name, what you are building, what you want to walk away with. Regulars skip it — thirty people take half an hour to go around, and nobody remembers thirty names anyway.",
        },
        {
          time: "10:40–11:50am",
          title: "Small tables",
          note: "Three or four tables, one topic or one product each. Move between them whenever you like — you do not have to wait until a conversation dries up, and leaving needs no hello and no goodbye. That is how this format is meant to work.",
        },
        {
          time: "From 12:00pm",
          title: "Keep talking · lunch",
          note: "Entirely optional. Stay on if you want to keep going, leave at twelve if you do not. Last time the hour after we wrapped was the best part.",
        },
      ],
    },

    gallery: {
      eyebrow: "§ 06 — The room",
      title: "A few shots from every session.",
      lede: "Recognisable faces are covered to protect the people who came. Open a session to see everything from that morning.",
      archiveCta: "The full record of each session",
      sessions: [
        {
          date: "2026-08-06",
          title: "Session one",
          note: "26 signed up, 18 to 20 turned up, from indie developers to lawyers, accountants and business owners.",
          photos: [
            { src: "/photos/session-01-1", alt: "The first session, a long table full of people", width: 1200, height: 900 },
            { src: "/photos/session-01-2", alt: "The Darling Harbour side, someone talking about what they are building", width: 1200, height: 900 },
            { src: "/photos/session-01-3", alt: "Another angle on the room", width: 1200, height: 900 },
            { src: "/photos/session-01-4", alt: "The venue before anyone arrived", width: 1200, height: 900 },
          ],
        },
        {
          date: "2026-08-13",
          title: "Session two",
          note: "35 signed up, around 30 turned up. People carried on downstairs for another hour after we wrapped, and the ones who stayed for lunch kept going into the afternoon.",
          photos: [
            { src: "/photos/session-02-1", alt: "The venue before anyone arrived, a long table along the windows over Darling Harbour", width: 1600, height: 900 },
            { src: "/photos/session-02-2", alt: "Session two, around thirty people along the table by the windows", width: 1600, height: 903 },
            { src: "/photos/session-02-3", alt: "A fruit platter on the table, a row of people down the length of it", width: 978, height: 1304 },
            { src: "/photos/session-02-4", alt: "Coffee, a croissant and a single white rose on the table", width: 1200, height: 1600 },
          ],
        },
        {
          date: "2026-08-20",
          title: "Session three",
          note: "21 signed up, a little over 20 turned up. Four tables this time — growth and business, B2B, B2C, and hands-on AI. You picked one on the way in, and took another if the one you wanted was full.",
          photos: [
            { src: "/photos/session-03-1", alt: "A fruit platter, bread and a white rose on the table, people talking behind it", width: 1448, height: 1086 },
            { src: "/photos/session-03-2", alt: "Session three, the long table full on both sides, someone standing at the far end", width: 1600, height: 900 },
            { src: "/photos/session-03-3", alt: "Another angle on the table, Darling Harbour through the windows", width: 1600, height: 900 },
            { src: "/photos/session-03-4", alt: "Looking down the table from the other end, a row of people along the windows", width: 1600, height: 900 },
            { src: "/photos/session-03-5", alt: "The far end of the table, two people talking by the bar", width: 1600, height: 900 },
            { src: "/photos/session-03-6", alt: "Around the end of the session, some still seated, some standing by the bar", width: 1600, height: 900 },
          ],
        },
        {
          date: "2026-08-27",
          title: "Session four",
          note: "20 signed up, 18 turned up. Three people opened by showing what they are building — one with a few shipped apps and a growth problem, one who has replaced most of his agency with agents. Four tables after that, and fifteen of us went to lunch together.",
          photos: [
            { src: "/photos/session-04-1", alt: "Around half past ten, people arriving, tables not yet full behind them", width: 1600, height: 900 },
            { src: "/photos/session-04-2", alt: "The long table along the windows over Darling Harbour, a conversation already going in the corner", width: 1600, height: 900 },
            { src: "/photos/session-04-3", alt: "Another angle on the same room, the row by the windows filling up", width: 1600, height: 900 },
            { src: "/photos/session-04-4", alt: "The corner booth, a few people gathered around one laptop", width: 1600, height: 900 },
            { src: "/photos/session-04-5", alt: "A group standing and talking before the start, two laptops open on the table beside them", width: 1600, height: 900 },
          ],
        },
      ],
      photoCount: (n: number) => `${n} photo${n === 1 ? "" : "s"}`,
    },

    membersTeaser: {
      eyebrow: "§ 02 — Who you will meet",
      title: "Who you will actually meet.",
      lede: "Everyone who comes has a card: what they are building, their business, a channel, a community — or just one line about what they are looking for. The two fields that do the work are «looking for» and «can help with» — a cofounder, a first batch of users, someone who has already hit the wall you are hitting, mostly get found through those two. No product needed; there are always more listeners than presenters here.",
      cta: "See the member wall",
      ctaSecondary: "Claim my card",
    },

    wharfTeaser: {
      eyebrow: "§ 04 — What people are asking",
      title: "Know what people are asking, before Thursday.",
      lede: "The line people write on the sign-up form — what they most want to ask — ends up on the Wharf. See one you can answer, and Thursday is ten minutes with that person instead of an hour working out who to talk to.",
      cta: "Go down to the Wharf",
      count: "{n} questions this week",
      empty: "Nobody has put a question up for this week yet.",
    },

    worksTeaser: {
      eyebrow: "§ 05 — What has been built",
      title: "What this room has built.",
      lede: "A dozen products, half of them shipped or earning, and some that still only run on somebody's laptop. All of it comes off the member wall — being stuck somewhere is usually the more interesting conversation.",
      cta: "See what people have built",
    },

    rules: {
      eyebrow: "§ 08 — House rules",
      title: "All five of them.",
      items: [
        "It runs even if two people show up.",
        "The time never moves — Thursday mornings, always. The next few sessions are at Vogue Cafe on the Darling Harbour waterfront; the address is on the first screen. If a venue ever has to change, it is posted the day before.",
        "Free, no tickets. Signing up is only so we know how many chairs.",
        "Hosting a table is always optional. Host one if you want to, otherwise move between them and listen. People who only come to listen are equally welcome.",
        "Show, don't sell. What you built is your marketing — present it properly at your own table, just never over someone else's. People here only to harvest contacts or hunt will be asked to leave.",
      ],
    },

    signup: {
      eyebrow: "§ 09 — Sign up",
      title: "Sign up and I will send you the address.",
      lede: "The venue follows the headcount — a big table at a cafe when we are small, a room with a screen once we are not. So signing up genuinely helps me book the right thing.",
      returning: {
        hello: "Welcome back, {name}. Just pick a session, I have the rest.",
        notYou: "Not you, or need to change your details?",
      },
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
        topic: "What do you most want to talk about, or ask, this week",
        topicPlaceholder: "An iOS cofounder / how the R&D tax offset actually gets claimed / how other people's AI workflows look",
        topicHint:
          "One line is enough. This is the line most likely to get you helped on the day — the more specific it is, the more likely someone picks it up. It shows on your member card as \"This week\", and you can change it every week. Leave it blank if nothing comes to mind.",
        publishCard: "Put this on the member wall",
        publishCardHint:
          "Tick this and your name, what you are working on, and what you want to talk about this week show up at vibethursday.com/members, so people can work out who to find before they arrive. Your email and WeChat ID never appear there. You can edit it or take it down whenever you like.",
        contactPrivacy: "Both fields are visible only to me, the organiser. Never published, never passed to anyone else, never used for marketing.",
        building: "What are you working on?",
        buildingPlaceholder: "A product, a side project, or just what you have been learning. A sentence or two is plenty.",
        demoIntent: "Want to host a table this time?",
        demoOptions: [
          { value: "yes", label: "Yes, I'll host one" },
          { value: "maybe", label: "Maybe" },
          { value: "listen", label: "Just listening" },
        ],
        demoIntentHint:
          "The bar is low: it does not have to be finished, there are no slides, and something you are half-way through and stuck on makes for a better table than something that works. You do not even need a product — one question is enough to host a table.",
        session: "Which session are you coming to?",
        sessionTimeSuffix: "10am",
        sessionNone: "Mornings do not work for me (evening or weekend, please)",
        sessionNoneHint:
          "Thursday mornings are working hours for a lot of people. Pick this and you are still on the list — if an evening or weekend one ever happens, this is who I go to.",
        availability: "What other times could you make?",
        availabilityHint: "Optional, pick as many as apply. This is the only thing deciding whether a second session happens and when — enough people on one slot and that slot runs.",
        availabilityOptions: [
          { value: "weekday_evening", label: "Weekday evenings" },
          { value: "weekend_day", label: "Weekend daytime" },
          { value: "weekend_evening", label: "Weekend evenings" },
        ],
        // See the Chinese block above for why these three are folded away, and
        // why the spend question asks about money rather than about tokens.
        extras: "A few more, all skippable: how you heard about this, which AI you use",
        aiModels: "Which AI models do you mostly use?",
        aiModelsHint:
          "Optional, pick as many as apply. It tells me how the room splits between overseas and Chinese models — which decides what gets demoed on the day, and whether shared subscriptions or China-hosted APIs are worth a table.",
        aiModelGroups: [
          {
            label: "Overseas",
            options: [
              { value: "intl_openai", label: "ChatGPT / GPT" },
              { value: "intl_claude", label: "Claude" },
              { value: "intl_gemini", label: "Gemini" },
              { value: "intl_other", label: "Other overseas (Grok, Llama…)" },
            ],
          },
          {
            label: "China",
            options: [
              { value: "cn_deepseek", label: "DeepSeek" },
              { value: "cn_qwen", label: "Qwen" },
              { value: "cn_kimi", label: "Kimi" },
              { value: "cn_doubao", label: "Doubao" },
              { value: "cn_other", label: "Other China (GLM, MiniMax…)" },
            ],
          },
        ],
        aiSpend: "Roughly what do you spend on AI a month?",
        aiSpendHint:
          "Optional. No need to open a billing page — pick whichever line sounds most like you. This is about how heavily you use the stuff, not about the money. In USD.",
        aiSpendSkip: "(Skip)",
        aiSpendOptions: [
          { value: "free", label: "Free tiers only" },
          { value: "lt_50", label: "A subscription or two (under 50)" },
          { value: "50_200", label: "Subscriptions plus some API (50–200)" },
          { value: "200_1000", label: "API / agents running daily (200–1000)" },
          { value: "gt_1000", label: "Batch jobs, or a team on it (1000+)" },
        ],
        source: "How did you hear about this?",
        sourcePlaceholder: "Optional",
      },
      supportNote:
        "It is free and stays free. A venue does charge a minimum spend or a room fee each week, usually a hundred or two, which I cover — ",
      supportNoteCta: "what running it costs",
      supportNoteTail: ". Chipping in is optional and changes nothing either way.",
      submit: "Sign up",
      submitting: "Sending…",
      successTitle: "Got it.",
      successBody: "The address and a reminder will land in your inbox. If you left a WeChat ID I will add you to the group too.",
      successClaimBody: "While you are here, claim your member card — it is already prefilled from what you just wrote, so it is a two-word edit away. On the day it doubles as your name badge.",
      successClaimCta: "Claim my card",
      successSupportBody: "Separately: I cover the venue myself — ",
      successSupportCta: "there is a page for it",
      successSupportTail: ", entirely optional, and it changes nothing either way.",
      errorGeneric: "That did not go through. Give it a moment and try again, or scan the WeChat code below.",
      errorRobot: "The bot check did not pass. Reload the page and try again.",
      errorRequired: "Name and email are required.",
      errorNeedContact: "Leave at least one way to reach you — email or WeChat.",
      errorEmail: "That email address does not look right.",
    },

    faq: {
      eyebrow: "§ 10 — Questions",
      title: "The ones people ask first.",
      items: [
        {
          q: "I have not built anything yet. Can I come?",
          a: "Yes. Hosting a table is optional, and there are always more people moving between tables than hosting one. The bar for hosting is low too: nothing has to be finished, there are no slides, and something you are stuck half-way through beats something that works. You do not even need a product — one question is enough. The only real bar is genuine interest — this is not a networking room.",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "Do I need to code?",
          a: "No. What you made with AI does not have to be code — a content pipeline, an automation, a prompt system all count.",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "What language is it in?",
          a: "Mostly Mandarin right now, and there is no plan for an English session yet. The language is not a limitation, it is why the conversation goes deep — Sydney is not short of English-language AI meetups, it was short of this one. If an English session ever happens it will be a separate one, not this one translated.",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "Where exactly?",
          a: "Vogue Cafe, Retail 5, 35 Wheat Road, Darling Harbour NSW 2000 — on the Darling Harbour waterfront, below W Sydney. That is the venue for the next few sessions. You get the address again after signing up.",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "Does it cost anything?",
          a: "No. No tickets, no membership fee, and that will not change. Everyone at the table orders a drink — coffee, tea, whatever you like — and that is your own tab. It is not costless though: a venue charges either a minimum spend or a room fee, usually a hundred or two, and I currently cover it. If you ever want to help carry that, ",
          href: "/support",
          linkLabel: "there is a page for it",
          aTail: ". Chipping in is entirely optional, with nobody able to see who did and who did not. Separately, there is no pay-for-stage-time sponsorship: floor time is earned by building something, not bought. Someone offering a room with no strings attached is a different question.",
        },
        {
          q: "Can I promote my own product here?",
          a: "Yes, that is the format, not a loophole. Showing what you built is marketing. Looking for users, a cofounder, or feedback belongs on your member card, or at a table you host yourself. The only line is that someone else's table is not your stage. That applies to everyone, me included.",
          href: null,
          linkLabel: null,
          aTail: null,
        },
        {
          q: "Why mornings, not afternoons?",
          a: "3pm collides with school pickup, which rules out anyone with kids. Mornings also fix a practical problem: plenty of Sydney CBD cafes shut by mid-afternoon. If mornings are working hours for you, do not just close the tab — sign up and pick ",
          href: "#signup",
          linkLabel: "\"mornings do not work for me\"",
          aTail: " instead. If an evening or weekend session ever happens, that list is who I go to.",
        },
        {
          q: "I cannot make this week. Can I come next week?",
          a: "Of course. It runs every week and you do not need a streak. Just ",
          href: "#signup",
          linkLabel: "come back and pick the session",
          aTail: " before each one you are coming to — I book the table off that number. After the first time it is two taps; your details are remembered.",
        },
      ],
    },

    contact: {
      eyebrow: "§ 11 — Contact",
      title: "Can't find us? Add me on WeChat.",
      lede: "Venue changes, questions before you come, or you're lost downstairs on the day — scan and message me directly. Faster than email.",
      caption: "Scan with WeChat",
      alt: "James's WeChat QR code",
    },

    // The first sentence has to be "it's free", not "support us". Reversed, the
    // page reads as the first step towards charging — the exact reading this
    // whole design exists to avoid.
    support: {
      meta: {
        title: "What this costs · Vibe Thursday",
        description:
          "The meetup is free and stays free. It is not costless though — a venue charges a minimum spend or a room fee each week, usually a hundred or two. If you ever want to help carry that, this is where.",
      },
      eyebrow: "§ Costs",
      title: "It is free. It is not costless.",
      lede: "The important part first: this meetup is free, always will be, and there will never be a ticket or a membership fee. This page is not selling anything.",

      costTitle: "What a week costs",
      costItems: [
        {
          label: "The venue",
          value: "A$100–200",
          note: "Some places charge a minimum spend, some charge for the room. It changes week to week, it does not change with how many people come, and the odd session runs higher.",
        },
        {
          label: "Your drink",
          value: "Your own tab",
          note: "The venue asks that everyone at the table orders something — coffee, tea, a soft drink, a juice. It does not have to be coffee. Unrelated to the above, and it is your own tab.",
        },
      ],
      costNote:
        "I currently cover that myself. Not unaffordable, just no reason for one person to carry it.",

      askTitle: "If you want to chip in",
      askBody:
        "Ten or twenty dollars is plenty. Once, occasionally, or never — all completely fine. Most people who come will not chip in, which is normal and changes nothing.",
      askScaleNote:
        "For scale: a session costs roughly a hundred or two, with about twenty people in the room — a few dollars each. There is no need to give more. This is not a fundraiser.",
      askOptIn:
        "If you want to be on the \"who keeps this going\" list, put a name in the payment message. Leave it out and you are not listed, and I will not ask.",
      linkCta: "Chip in",

      thanksTitle: "Who keeps this going",
      thanksLede:
        "As in any open source project, a contributor was never only the person who paid: people who brought a friend, who showed something, who helped set up, are all here. The list is opt-in — put a name in the payment message if you want to be on it, leave it out if you do not, and nobody will ask.",
      thanksKinds: {
        money: "chipped in",
        demo: "showed something",
        brought: "brought people",
        helped: "helped out",
      },
      thanksNote:
        "The order is when people joined it, not a ranking, and amounts are never recorded. Not being on this list means nothing — most people never put their name down.",

      rulesTitle: "Three things that will not change",
      rules: [
        "Nobody can be spotted for not giving. Who gave and how much is never said, and the thank-you list is opt-in — someone who chipped in and stayed off it looks exactly like someone who never did.",
        "Chipping in buys nothing — not floor time, not billing, not any kind of preference. Time on the floor is earned by building something. That applies to everyone, me included.",
        "Anything left over is not refunded. It rolls into the next session and cushions things like a venue price rise. Shortfalls are on me.",
      ],

      back: "← Back to the home page",
    },

    footer: {
      tagline: "See you Thursday.",
      location: "Vogue Cafe, Darling Harbour · Thursdays, doors 10am",
      supportLink: "What this costs",
      sourceLink: "This site's source on GitHub",
    },

    members: {
      meta: {
        title: "Members · Vibe Thursday",
        description:
          "The people who come to Vibe Thursday and what they are working on. Products, businesses, channels, communities — or just what they want to talk about.",
      },
      eyebrow: "§ Members",
      title: "Who comes, and what they are working on.",
      lede: "This all used to live in a WeChat group and vanish within days. Now it is here. You do not need a product to have a card — what you are looking for is more useful than what you have shipped.",
      claimCta: "Claim my card",
      editCta: "Edit my card",
      thisWeek: "Coming this Thursday",
      lastSession: "At the last session",
      everyone: "Everyone",
      others: "Everyone else",
      empty: "Nobody has claimed a card yet. Be first.",
      emptyFiltered: "Nobody here yet under that filter.",
      // Both are phrased to read correctly at one as well as at twelve, which
      // is why neither says "people" or "sessions" with a bare count in front.
      countLabel: "{n} shown",
      attended: "Sessions: {n}",
      lookingFor: "Looking for",
      canHelp: "Can help with",
      thisWeekTopic: "This week",
      topicOn: "Wanted to talk about, {date}",
      topicUndated: "Wants to talk about",
      visit: "Open",
      back: "← All members",
      filterAll: "All",
      searchLabel: "Search members",
      searchPlaceholder: "Forgotten the name? Search what they do — \"SEO\", \"ads\"",
      searchSubmit: "Search",
      searchClear: "Clear search",
      searchEmpty: "Nothing matches \u201c{q}\u201d. Try another word — or they may not have claimed a card yet.",
      clearTag: "Clear tag filter",
      roles: {
        builder: "Building a product",
        business: "Has a business",
        advisor: "Professional services",
        creator: "Makes content",
        organiser: "Runs a community",
        listener: "Here to listen",
      },
      kinds: {
        product: "Product",
        business: "Business",
        media: "Channel",
        community: "Community",
        profile: "Profile",
      },
      stages: {
        idea: "💡 Idea",
        local: "🔧 Runs locally",
        beta: "🧪 In beta",
        live: "🚀 Live",
        revenue: "💰 Making money",
      },
      platforms: {
        xhs: "Xiaohongshu",
        wechat: "WeChat",
        x: "X",
        linkedin: "LinkedIn",
        youtube: "YouTube",
        podcast: "Podcast",
        github: "GitHub",
        substack: "Substack",
        other: "Other",
      },
    },

    wharf: {
      meta: {
        title: "The Wharf · Vibe Thursday",
        description:
          "What people are bringing to Vibe Thursday. The one line everyone writes on the sign-up form — what they most want to ask — all in one place, so you know who to talk to before Thursday.",
      },
      eyebrow: "§ The Wharf",
      title: "What people are asking.",
      lede: "Things somebody genuinely wants to ask, and that ninety minutes on a Thursday will not always get to. See one you can answer, and Thursday is ten minutes with that person.",
      place: "Down the wharf for a serve of chips.",
      say: {
        waiting: "Bored… {n} questions up this week",
        quiet: "Nothing up for this week yet. The earlier ones are below.",
        empty: "Nothing doing.",
      },
      thisWeek: "This week",
      noSession: "Cannot do Thursday mornings",
      comingLabel: "Coming this Thursday",
      emptyWeek: "Nothing up for this one yet. Write a line when you sign up and it lands here.",
      older: "{n} earlier sessions and {m} questions are not on this page — they are still on the cards they came from.",
      langNote: "The questions are in Mandarin. That is the language the room runs in, and they are printed here exactly as they were written.",
      strip: {
        q1: "Where are we flying to?",
        a1: "Down the wharf for chips, I reckon",
        q2: "You have misunderstood me, mate. I mean the ultimate point of it. What are we living for?",
        a2: "Chips. Down the wharf.",
      },
      gullAlt: "A silver gull standing on wharf decking, staring deadpan at a single chip lying in front of it.",
      panelAlt: [
        "Two silver gulls side by side on a wharf rail, looking out to sea, neither of them saying anything.",
        "The smaller gull has turned to the larger one; both beaks are open.",
        "Close-up of the larger gull, beak open, looking earnest.",
        "Close-up of the smaller gull, beak open, completely deadpan.",
      ],
      how: {
        title: "Want your question up here?",
        body: "Fill in «what do you most want to ask» when you sign up, and tick «put this on the member wall». Two steps, nothing else to fill in anywhere. The more specific it is, the more likely someone picks it up — «how do I grow» does much less than «my app only gets organic installs, where does the first paying user come from».",
        cta: "Sign up",
      },
      membersCta: "See the member wall",
    },

    archive: {
      meta: {
        title: "Sessions · Vibe Thursday",
        description:
          "Every Vibe Thursday: the photos from that morning, what people wanted to ask, and who was there.",
      },
      eyebrow: "§ Sessions",
      title: "Every session, and what happened.",
      lede: "The photos, the questions that were on the Wharf that week, and who came. They used to live on three different pages.",
      totals: {
        sessions: "Sessions",
        sessionsUnit: "",
        signups: "Have signed up",
        signupsUnit: "people",
        cards: "Member cards",
        cardsUnit: "",
        questions: "Questions",
        questionsUnit: "",
      },
      totalsNote:
        "«Have signed up» is not attendance. How many actually turned up to a session is in the line under that session.",
      questionsLabel: "On the Wharf that week",
      moreQuestions: "{n} more",
      morePhotos: "{n} more photos from that morning",
      posterAlt: "A coloured pencil drawing of {title}, made from that morning’s own photographs: the café on the water at Darling Harbour, people around tables, everyone seen from behind.",
      peopleLabel: "There that morning (of the people with a card)",
      peopleNote: "Only counts people who have claimed a card, so it is lower than the number in the room.",
      empty: "Nobody from this session has a card yet.",
      photoAlt: "Photos from this session",
      backToWharf: "Go to the Wharf",
    },

    works: {
      meta: {
        title: "Works · Vibe Thursday",
        description: "What the people who come to Vibe Thursday have built. Shipped, in beta, or still only running on a laptop.",
      },
      eyebrow: "§ Works",
      title: "What this room has built.",
      lede: "All of it comes off the member wall. Ordered the way the wall is — most recently around first — and not by how far along it is: being stuck somewhere is usually the more interesting conversation.",
      countLabel: "{n}",
      by: "by",
      visit: "Open",
      all: "All",
      empty: "Nothing at this stage yet.",
      emptyAll: "Nobody has put a product on the wall yet.",
      wallCta: "See the member wall",
    },

    claim: {
      meta: {
        title: "Claim your card · Vibe Thursday",
        description: "Sign up once and your member card is waiting for you.",
      },
      eyebrow: "§ Claim",
      title: "Claim your card",
      lede: "If you have signed up before, it is already yours. Match the name and email (or WeChat ID) you used — the card is prefilled from what you wrote then, so it is a two-word edit away from being ready.",
      nameLabel: "The name you signed up with",
      namePlaceholder: "Exactly as on the form",
      contactLabel: "Email or WeChat ID",
      contactPlaceholder: "Either one",
      privacy: "Both fields are only used to find your signup. Neither appears on your card and neither is published.",
      submit: "Claim",
      submitting: "Looking…",
      errorNotFound: "No signup matches that. Both the name and the contact have to match what you used when you signed up — ask me in the group if you are not sure.",
      errorRequired: "Both fields are needed.",
      errorGeneric: "That did not work. Give it a moment and try again.",
      noSignupLead: "Not signed up yet?",
      noSignupCta: "Sign up first, see you Thursday",
    },

    editor: {
      meta: { title: "My card · Vibe Thursday" },
      eyebrow: "§ My card",
      title: "My card",
      lede: "This is prefilled from what you wrote when you signed up. Make it say what you want people to see. Everything except your name is optional; anything left blank is simply not shown.",
      draftNote: "Not published yet — only you can see this.",
      liveNote: "Live on the member wall.",
      viewCard: "See the public version",
      backToWall: "← Member wall",
      displayName: "Name",
      handle: "Page address",
      handlePrefix: "/members/",
      handleHint: "Lowercase letters, numbers and hyphens. Leave it blank and one gets generated.",
      headline: "One line about you",
      headlinePlaceholder: "Who you are and what you are working on, in a sentence",
      bio: "A bit more",
      bioPlaceholder: "Optional. Background, what you are poking at, what you have been thinking about.",
      roles: "Which of these are you",
      rolesHint:
        "Pick as many as fit. Lawyers, accountants, grant and compliance people: pick \"Professional services\" — there are people here looking for you. \"Here to listen\" is a real answer too; there are always more listeners than presenters.",
      lookingFor: "🔎 Looking for",
      lookingForPlaceholder: "An iOS cofounder / my first ten users / someone who has done cross-border payments",
      canHelp: "🤝 Can help with",
      canHelpPlaceholder: "Three years of Google Ads / registering a company in Sydney the hard way",
      matchHint: "These two are the most useful thing on the wall. People find you through them, not through your title.",
      tags: "Tags",
      tagsPlaceholder: "AI agents, growth, design",
      tagsHint: "Comma separated, six at most.",
      tagsSuggest: "Already in use:",
      assets: "Your things",
      assetsHint:
        "Products, a business, a channel, a community, a profile link — add as many as apply, up to eight. None at all is completely fine; the card still works.",
      addAsset: "＋ Add one",
      removeAsset: "Remove",
      assetKind: "Type",
      assetTitle: "Name",
      assetTitlePlaceholder: "What it is called",
      assetTagline: "One line",
      assetTaglinePlaceholder: "What it does",
      assetUrl: "Link",
      assetUrlPlaceholder: "Optional",
      assetUrlHint: "Not shipped, only runs on your laptop? Leave the link empty and pick a stage instead — that is the more interesting answer anyway.",
      assetStage: "Stage",
      assetPlatform: "Platform",
      hidden: "Keep it off the wall for now",
      hiddenHint: "Ticking this pulls the card from the wall. Nothing is deleted and you can put it back any time.",
      saveDraft: "Save draft",
      publish: "Publish to the wall",
      update: "Save changes",
      saving: "Saving…",
      saved: "Saved.",
      errorName: "A name is needed.",
      errorSlug: "That address is taken. Pick another.",
      errorGeneric: "That did not save. Give it a moment and try again.",
      signOut: "Sign out",
      badgeCta: "Use my phone as a name badge",
      draftRestored: "Restored the edits you had not saved.",
      draftDiscard: "Discard them and use the saved version",
      avatar: "Photo",
      avatarUpload: "Upload a photo",
      avatarReplace: "Replace",
      avatarRemove: "Remove",
      avatarWorking: "Working…",
      avatarHint: "Cropped square and compressed automatically, shown only on your own card. Without one you get your initial.",
      avatarFailed: "That did not upload. Try another image or another browser.",
    },

    badge: {
      meta: { title: "Name badge · Vibe Thursday" },
      title: "Stand your phone up in front of you",
      lede: "Turn it sideways and prop it on the table. Anyone can scan the code to get your full card: what you are building, what you are looking for, what you can help with.",
      open: "Open the badge",
      exit: "Exit",
      scanHint: "Scan for my full card",
      draftWarning: "Your card is not published yet, so the code will not open for anyone. Hit \"Publish to the wall\" first.",
      keepAwakeNote: "The screen stays awake while this is open.",
      back: "← My card",
      exportCta: "Make a shareable image",
      exportAgain: "Make it again",
      exporting: "Making it…",
      exportLongPress: "Long-press the image below to save or forward it.",
      exportAlt: "Your card as an image — long-press to save",
      exportFailed: "That did not work. Try another browser.",
    },
  },
} as const;

/**
 * One language's copy.
 *
 * Written as the union of the two authored bundles rather than as one of them:
 * a handful of values genuinely differ in type between the two — `emailRequired`
 * is false in Chinese and true in English — and collapsing to a single bundle
 * would type those as constants and quietly make one branch of the signup form
 * look dead.
 */
export type Copy = (typeof copy)["zh"] | (typeof copy)["en"];

/**
 * The copy for one language.
 *
 * Every page reads its strings through here rather than indexing `copy`
 * directly, because one of the three languages is not in `copy` at all.
 * Traditional is built once per process and then handed out: the conversion
 * walks a few hundred strings, which is nothing once and wasteful per request.
 */
let traditional: Copy | undefined;

export function getCopy(lang: Lang): Copy {
  if (lang === "en") return copy.en;
  if (lang === "zh") return copy.zh;

  if (!traditional) {
    // The cast is the price of `as const`: every string in the converted clone
    // is a different literal from the one the type names, so TypeScript cannot
    // see the result as the same shape however true that is at runtime.
    traditional = {
      ...deepTranslate(copy.zh),
      // Never converted — a BCP 47 tag is not prose, and `zh-CN` on a
      // Traditional page tells a screen reader the wrong pronunciation.
      htmlLang: "zh-Hant",
    } as unknown as Copy;
  }

  return traditional;
}
