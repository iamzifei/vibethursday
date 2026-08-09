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
        "每周四上午，悉尼 CBD。一群在做东西的人围一张桌子，聊各自在用 AI 干什么、卡在哪。想给大家看点东西可以，只来听也完全没问题。免费。",
    },

    nav: {
      brand: "Vibe Thursday",
      cta: "报名",
      members: "成员",
    },

    hero: {
      eyebrow: "SYDNEY · EVERY THURSDAY",
      title: "Vibe Thursday",
      subtitle: "悉尼 · 每周四上午的 AI 局",
      lede: "一群在做东西的人围一张桌子喝咖啡，聊各自在用 AI 干什么、卡在哪。手上有东西想给大家看，随时可以；只想听，也完全没问题。产品、自动化流程、内容流水线、投放打法、提示词，甚至还没跑通的想法，都算。",
      facts: [
        { label: "时间", value: "每周四 10:00–13:00" },
        { label: "地点", value: "悉尼 CBD 一带" },
        { label: "费用", value: "免费，店里点杯喝的就行" },
      ],
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
      eyebrow: "§ 02 — 谁适合来",
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
      eyebrow: "§ 03 — 流程",
      title: "每周同一个节奏，不变。",
      slots: [
        {
          time: "10:00–10:45",
          title: "陆续到场 · 自由聊",
          note: "不急着开场。这一段是留给还在路上的人的，晚到不会错过什么。",
        },
        {
          time: "10:45–11:15",
          title: "一轮自我介绍",
          note: "每人 60 秒，硬计时。三件事：怎么称呼、在做什么、今天想从这儿拿走什么。第三件最重要，说具体点，桌上说不定就有人能接。",
        },
        {
          time: "11:15–12:00",
          title: "谁想给大家看东西",
          note: "讲 5 分钟加问答 5 分钟，硬计时，最多 4 位。宁可少而透，不凑数。想讲在报名时勾一下，现场临时想讲也行。",
        },
        {
          time: "12:00 之后",
          title: "自愿留下吃午饭",
          note: "不强制。想接着聊的一起吃，赶时间的 12 点就走。",
        },
      ],
    },

    gallery: {
      eyebrow: "§ 03.5 — 现场",
      title: "每一场都留了几张。",
      lede: "为保护参与者，照片里的人脸都做了处理。往下每加一场，就多一个折叠的相册。",
      // 新增一场：往下面加一条即可，页面按 date 倒序排、最新的默认展开。
      sessions: [
        {
          date: "2026-08-06",
          title: "第一场",
          note: "报名二十六个，到场十八九个，从独立开发者到律师、会计、企业主都有。",
          photos: [
            { src: "/photos/session-01-1.jpg", alt: "首场现场，一张长桌坐满了人" },
            { src: "/photos/session-01-2.jpg", alt: "临着达令港的一侧，有人在讲自己在做的东西" },
            { src: "/photos/session-01-3.jpg", alt: "另一个角度的现场" },
            { src: "/photos/session-01-4.jpg", alt: "开场之前的场地" },
          ],
        },
      ],
      photoCount: (n: number) => `${n} 张`,
    },

    // Sits on the home page between the photos and the house rules: by that
    // point the reader knows what the room is, and "who is in it" is the next
    // thing they want.
    membersTeaser: {
      eyebrow: "§ 03.6 — 成员",
      title: "来过的人都在这儿。",
      lede: "报过名就能认领一张自己的名片：在做的产品、公司业务、自媒体账号、社群，或者只写一句「想找什么」。没有产品也一样有名片——这个局里听的人本来就比讲的人多。以前这些都发在群里，翻两天就找不到了。",
      cta: "看成员墙",
      ctaSecondary: "认领我的名片",
    },

    rules: {
      eyebrow: "§ 04 — 几条规矩",
      title: "就这五条。",
      items: [
        "只来两个人也照办。",
        "时间雷打不动，每周四同一时段。场地按当周人数定，都在悉尼 CBD 一带、公共交通到得了，前一天发在群里。",
        "免费，不售票。报名只是为了估人数。",
        "给大家看东西永远是可选的。有就讲，没有就听，只来听的人一样欢迎。",
        "展示可以，插播不行。你做的东西就是你的宣发，在自己的时段里大方讲；别人讲的时候别转成推销。只来收名单、抓人、拉客的，会被请出去。",
      ],
    },

    signup: {
      eyebrow: "§ 05 — 报名",
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
        topic: "这周想聊点什么",
        topicPlaceholder: "写什么都行，一句话也可以",
        topicHint:
          "完全选填。有产品或者社媒账号，欢迎直接贴链接；没有也不用有压力，想聊的经验、卡住的问题、单纯好奇的话题，都算。认领过成员卡片的话，这句会显示在你卡片上的「本周想聊」。",
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
      // The highest-intent screen on the site, and claiming a card needs exactly
      // the signup that was just created. Anywhere else this ask is a chore.
      successClaimBody: "顺手认领一下你的成员卡片吧——已经按你刚才填的内容预填好了，改两个字就能发布。当天还能直接当桌牌用。",
      successClaimCta: "认领我的名片",
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
          a: "现阶段以中文为主，暂时也没有开英文场的计划。中文不是限制，是这个局能聊得深的原因——悉尼英文的 AI 聚会不缺，缺的是这个。以后真要开，那会是另外一场，不会把这场改成英文。",
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
          a: "能，这本来就是形式的一部分，给大家看东西本身就是宣发。找用户、找合伙人、找反馈，在自我介绍那一句「今天想拿走什么」里说，或者在你自己的分享时段里说。唯一的界线是：别人在讲的时候，那是别人的时间。这条对所有人一样，包括我。",
        },
        {
          q: "为什么是上午？下午不是更松吗？",
          a: "下午三点正好撞小学放学，家里有孩子的一律来不了。上午还顺带解决一个实际问题：悉尼 CBD 不少咖啡厅下午三四点就打烊，上午反而好占位子。",
        },
        {
          q: "我这周来不了，下周还能来吗？",
          a: "当然。它每周都在，不用连着来。来了就是自己人。每次来之前回来点一下、选个场次就行，我按人数订位子——第二次之后就是两下的事，资料都记着。",
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
      visit: "打开",
      back: "← 所有成员",
      filterAll: "全部",
      clearTag: "清除标签筛选",
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
      exportCta: "导出图片 / 分享",
      exporting: "生成中…",
      exportSaved: "已下载到本地。",
      exportFailed: "生成失败了，换个浏览器再试一次。",
    },
  },

  en: {
    htmlLang: "en-AU",
    langSwitchLabel: "中文",
    langSwitchHref: "/?lang=zh",

    meta: {
      title: "Vibe Thursday · Sydney's weekly AI meetup",
      description:
        "Every Thursday morning in Sydney CBD. A table of people who build things, talking about what they are doing with AI and where they are stuck. Show something if you want to, or just listen. Free.",
    },

    nav: {
      brand: "Vibe Thursday",
      cta: "Sign up",
      members: "Members",
    },

    hero: {
      eyebrow: "SYDNEY · EVERY THURSDAY",
      title: "Vibe Thursday",
      subtitle: "Sydney · every Thursday morning",
      lede: "A table of people who build things, over coffee, talking about what they are doing with AI and where they are stuck. Got something to show? Go ahead. Only want to listen? Also fine. A product, an automation, a content pipeline, an ad playbook, a prompt system, or an idea that does not work yet all count.",
      facts: [
        { label: "When", value: "Thursdays, 10am–1pm" },
        { label: "Where", value: "Sydney CBD area" },
        { label: "Cost", value: "Free, just order a drink" },
      ],
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
      eyebrow: "§ 02 — Who it is for",
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
      eyebrow: "§ 03 — Run of show",
      title: "Same rhythm every week.",
      slots: [
        {
          time: "10:00–10:45am",
          title: "Arrive · open chat",
          note: "No rush to start. This stretch is for the people still on their way, so arriving late costs you nothing.",
        },
        {
          time: "10:45–11:15am",
          title: "Intros round",
          note: "Sixty seconds each, hard timer. Three things: your name, what you are building, and what you want to walk away with today. The third one matters most. Be specific and someone at the table may be able to help.",
        },
        {
          time: "11:15am–12:00pm",
          title: "Anyone who wants to show something",
          note: "Five minutes plus five for questions, hard timer, four people max. Better to go deep on a few than to fill slots. Tick the box when you sign up, or just volunteer on the day.",
        },
        {
          time: "From 12:00pm",
          title: "Optional lunch",
          note: "Entirely optional. Stay if you want to keep talking, leave at twelve if you do not.",
        },
      ],
    },

    gallery: {
      eyebrow: "§ 03.5 — The room",
      title: "A few shots from every session.",
      lede: "Faces are covered to protect the people who came. Each session adds another folded album below.",
      sessions: [
        {
          date: "2026-08-06",
          title: "Session one",
          note: "26 signed up, 18 to 20 turned up, from indie developers to lawyers, accountants and business owners.",
          photos: [
            { src: "/photos/session-01-1.jpg", alt: "The first session, a long table full of people" },
            { src: "/photos/session-01-2.jpg", alt: "The Darling Harbour side, someone talking about what they are building" },
            { src: "/photos/session-01-3.jpg", alt: "Another angle on the room" },
            { src: "/photos/session-01-4.jpg", alt: "The venue before anyone arrived" },
          ],
        },
      ],
      photoCount: (n: number) => `${n} photo${n === 1 ? "" : "s"}`,
    },

    membersTeaser: {
      eyebrow: "§ 03.6 — Members",
      title: "Everyone who comes is on the wall.",
      lede: "Sign up once and your card is yours to claim: what you are building, your business, a channel, a community — or just one line about what you are looking for. No product needed. There are always more listeners than presenters here, and this all used to vanish into a chat log within days.",
      cta: "See the member wall",
      ctaSecondary: "Claim my card",
    },

    rules: {
      eyebrow: "§ 04 — House rules",
      title: "All five of them.",
      items: [
        "It runs even if two people show up.",
        "The time never moves. The venue is set each week by the headcount, always around Sydney CBD and reachable by public transport, and posted the day before.",
        "Free, no tickets. Signing up is only so we know how many chairs.",
        "Showing something is always optional. Bring it if you have it, otherwise just listen. People who only come to listen are equally welcome.",
        "Show, don't sell. What you built is your marketing — present it properly in your own slot, just never over someone else's. People here only to harvest contacts or hunt will be asked to leave.",
      ],
    },

    signup: {
      eyebrow: "§ 05 — Sign up",
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
        topic: "Anything you would like to talk about",
        topicPlaceholder: "One line is plenty",
        topicHint:
          "Entirely optional. Got a product or a social account? Drop the link. No pressure if not, an experience worth passing on, a problem you are stuck on, or something you are just curious about all count. If you have claimed a member card, this shows there as \"This week\".",
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
      successClaimBody: "While you are here, claim your member card — it is already prefilled from what you just wrote, so it is a two-word edit away. On the day it doubles as your name badge.",
      successClaimCta: "Claim my card",
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
          a: "Mostly Mandarin right now, and there is no plan for an English session yet. The language is not a limitation, it is why the conversation goes deep — Sydney is not short of English-language AI meetups, it was short of this one. If an English session ever happens it will be a separate one, not this one translated.",
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
          a: "Yes, that is the format, not a loophole. Showing what you built is marketing. Looking for users, a cofounder, or feedback belongs in the \"what you want to walk away with\" line of your intro, or in your own slot if you are showing something. The only line is that while someone else is talking, that time is theirs. That applies to everyone, me included.",
        },
        {
          q: "Why mornings, not afternoons?",
          a: "3pm collides with school pickup, which rules out anyone with kids. Mornings also fix a practical problem: plenty of Sydney CBD cafes shut by mid-afternoon.",
        },
        {
          q: "I cannot make this week. Can I come next week?",
          a: "Of course. It runs every week and you do not need a streak. Just come back and pick the session before each one you are coming to — I book the table off that number. After the first time it is two taps; your details are remembered.",
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
      visit: "Open",
      back: "← All members",
      filterAll: "All",
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
      exportCta: "Export / share image",
      exporting: "Making it…",
      exportSaved: "Downloaded.",
      exportFailed: "That did not work. Try another browser.",
    },
  },
} as const;

export type Copy = (typeof copy)[Lang];
