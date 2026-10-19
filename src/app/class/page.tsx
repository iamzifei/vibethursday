import type { Metadata } from "next";
import type React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WeChatMark } from "@/components/WeChatMark";
import { Celebration } from "@/components/Celebration";
import { currentAccount } from "@/lib/account";
import { getCopy } from "@/lib/content";
import { COURSE, looksLikeCourseRef } from "@/lib/course";
import { getCourseOrderByRef, getSignupProfile } from "@/lib/db";
import { wechatLoginHref } from "@/lib/login-link";

// Who is asking changes the form, and a reference changes the whole page.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ ref?: string; err?: string; other?: string; done?: string }>;
};

export const metadata: Metadata = {
  title: `Vibe Thursday 共创会员 · ${COURSE.title}`,
  // Shared by link in the group and on Moments; not something to rank for,
  // and Thursdays stay the face of this site.
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  missing: "名字和微信号要填一下，好让我们对上你的转账。",
  rate: "提交得太频繁了，过几分钟再试一次。",
  failed: "没提交上，请再试一次；还不行的话直接私信 James（首页最下面有他的微信二维码）。",
};

const BIZ_FOCUS_OPTIONS = [
  { value: "leads", label: "找客户、获客" },
  { value: "content", label: "做内容、营销" },
  { value: "service", label: "客服、回消息" },
  { value: "ops", label: "内部流程、省人手" },
  { value: "unsure", label: "还不知道" },
];

const INDUSTRY_OPTIONS = [
  { value: "property", label: "房产 / 建筑 / 装修" },
  { value: "finance", label: "金融 / 贷款 / 会计 / 保险" },
  { value: "professional", label: "法律 / 移民 / 留学 / 咨询" },
  { value: "food", label: "餐饮 / 食品" },
  { value: "ecommerce", label: "电商 / 零售 / 门店" },
  { value: "trade", label: "外贸 / 物流 / 制造" },
  { value: "education", label: "教育 / 培训" },
  { value: "health", label: "医疗 / 健康 / 美容" },
  { value: "media", label: "媒体 / 内容 / 营销 / 设计" },
  { value: "tech", label: "软件 / 互联网 / IT" },
  { value: "other", label: "其他" },
];

type IconName = "advisor" | "list" | "laptop" | "tool" | "handshake" | "people" | "globe" | "gift" | "calendar" | "pin";

/** What a member gets, one card each. `hot` marks the headline benefit. */
const FEATURES: { icon: IconName; title: string; body: string; hot?: boolean }[] = [
  {
    icon: "advisor",
    title: "一个懂你生意的 AI 商业顾问",
    body: "10/25 课上装好，电脑手机都能用。给它资料夹（知识库）和岗位手册（技能），比如产品、客户、回客户的话术；经营上的事随时问它。",
    hot: true,
  },
  {
    icon: "list",
    title: "一张能开工的需求单 + 一对一",
    body: "把「帮我弄个 AI」变成能交给人做的任务。课后线上一对一 15 分钟，只有你和我，需提前预约。",
  },
  {
    icon: "laptop",
    title: "每周二研讨会，全年免费",
    body: "十来个人打开电脑看项目、答疑、对接资源。非会员单次 30 澳元 + GST。10/27 首场，带课上的作业来展示。",
  },
  {
    icon: "tool",
    title: "共性刚需，我们免费做",
    body: "从大家的需求单里挑出刚需，做成能直接用的 AI 工具并教会你。需求单写得越清楚越容易被挑中，以实际评估为准。",
  },
  {
    icon: "handshake",
    title: "复杂需求，对接靠谱的人",
    body: "做产品、做推广这类大活，优先介绍社群里做过、靠得住的人。",
  },
  {
    icon: "people",
    title: "一年的会员群和圈子",
    body: "案例和工具分享，随时提问，认识各行各业在把 AI 用进生意的人。",
  },
];

/** The class morning, one line each. */
const OUTLINE: { time: string; title: string; body?: string }[] = [
  { time: "9:00", title: "AI 能干什么、不能干什么", body: "分清今天就能交给 AI 的活，写下你生意里最头疼的一件事" },
  { time: "9:40", title: "装好你的 AI 商业顾问", body: "装在你的电脑和手机上，告诉它你的生意，用那件事问它" },
  { time: "10:40", title: "茶歇" },
  { time: "11:00", title: "写你的需求单，做出第一个技能", body: "顾问一格一格问你，答完就是需求单；再写成岗位手册，存进去试跑一次" },
  { time: "12:00", title: "交给 AI 之前，先对一遍", body: "拍板的事不交、对客人的承诺本人看过、隐私先遮掉、数字对原件" },
  { time: "12:20", title: "下课以后", body: "约好一对一，讲清楚刚需怎么挑、会员权益怎么用" },
  { time: "12:40", title: "答疑、合影，13:00 结束" },
];

const FAQ: { q: string; a: string }[] = [
  { q: "599 包含什么？", a: "一年的 Vibe Thursday 共创会员：10/25 这一上午的课、课后一对一、刚需免费做的机会、全年周二研讨会和会员群。前 15 名另送一页式官网并上线，另送一年 AI 创始人 IP 会员。" },
  { q: "我完全不懂 AI，能跟上吗？", a: "能。每一步都跟着做，卡住了举手，我们过来帮你。" },
  { q: "要准备什么？", a: "建议带笔记本电脑，充好电，手机也带上；没有电脑用手机也能跟。想好你生意里最头疼的一件事，想拿来练的聊天截图或单据可以带上，客人的姓名电话先遮掉。" },
  { q: "我主要想用 AI 做内容、获客，管用吗？", a: "课上可以把「做内容」写成需求单，用顾问把选题、文案理清楚。系统地讲自媒体获客，在送你的 IP 会员公开课里，两个正好接上。" },
  { q: "我生意上的事，会被别人听到吗？", a: "课上的练习在你自己的设备上做。具体的生意问题留到一对一里说，只有你和我。" },
  { q: "用中文上课吗？", a: "是，全程中文。" },
];

/** Line icons for the feature cards, drawn in currentColor. */
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    advisor: <><path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3z" /><path d="M9.5 20.5h5" /></>,
    list: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    laptop: <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></>,
    tool: <path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />,
    handshake: <><path d="M3 11l4-4 4 2 3-2 4 1 3 3" /><path d="M7 13l3 3 2-1 2 2 3-3" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5a5 5 0 0 1 5 5" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    gift: <><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M2 9h20M12 9v11M12 9c-2-4-6-4-6-1s6 1 6 1zM12 9c2-4 6-4 6-1s-6 1-6 1z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    pin: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/**
 * The paid class (`course.ts`): what it is, a short form, and — once signed
 * up — how to pay. Chinese only: the class is taught in Chinese.
 *
 * Large type and few fields on purpose: keep the form short and the type big.
 * WeChat login comes first; someone it recognises fills in two optional
 * questions and taps once — or taps "not me" to sign up someone else.
 */
export default async function ClassPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const c = getCopy("zh");

  const ref = looksLikeCourseRef(params.ref) ? params.ref : null;
  const order = ref ? await getCourseOrderByRef(ref).catch(() => null) : null;

  let knownName: string | null = null;
  if (!order && params.other !== "1") {
    const account = await currentAccount();
    if (account) {
      try {
        const profile = await getSignupProfile(account.signupId);
        if (profile?.wechat) knownName = profile.name;
      } catch (error) {
        console.error("[class] could not read the recognised signup", error);
      }
    }
  }

  const loginHref = wechatLoginHref("/class", null);
  const error = params.err && Object.hasOwn(ERRORS, params.err) ? ERRORS[params.err] : null;
  const paymentInfo = process.env.COURSE_PAYMENT_INFO?.replace(/\\n/g, "\n").trim() ?? "";

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path="/class" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: order ? "680px" : "1040px", fontSize: "1.1rem" }}>
            {order ? (
              // ── Signed up: how to pay ─────────────────────────────────
              <div className="stack-6">
                <div className="stack-3">
                  <span className="eyebrow">§ 报名成功</span>
                  <h1>
                    {order.status === "cancelled"
                      ? "这条报名已取消"
                      : order.status === "waitlist"
                        ? "名额已满，你在候补名单上"
                        : order.status === "paid"
                          ? `${order.name}，欢迎加入！`
                          : order.claimed
                            ? `${order.name}，欢迎加入！`
                            : "报上了，最后一步：转账"}
                  </h1>
                </div>

                {order.status === "cancelled" ? (
                  <p className="body-lg">这条报名已经取消了，不用转账。想重新报名，回到报名页再填一次就行。</p>
                ) : order.status === "waitlist" ? (
                  <p className="body-lg">名额已经满了。有人退出，我们会按顺序微信联系你，先不用转账。</p>
                ) : order.status === "paid" ? (
                  <p className="body-lg">已经收到你的转账了，{COURSE.dateLabel}见。</p>
                ) : order.claimed ? (
                  <div className="stack-6">
                    {params.done === "1" && <Celebration />}
                    <div className="tick" aria-hidden="true">✓</div>
                    <p className="body-lg" style={{ margin: 0 }}>
                      转账通知收到了。我们核对到账后，会在微信上联系你，拉你进学员群。
                    </p>
                    <p className="body-lg" style={{ margin: 0 }}>
                      很多老板听 AI 听了一年，你是真的动手的那一个。
                    </p>
                    <div className="card card--accent stack-2">
                      <h2 className="h3">{COURSE.dateLabel}之前，你可以先做一件事</h2>
                      <p style={{ margin: 0 }}>
                        想好你生意里最头疼的那一件事。那天上午，我们就从它开始：把它写成一张需求单，看看 AI 能帮你做掉多少。
                      </p>
                    </div>
                    <p className="body" style={{ margin: 0 }}>建议带上笔记本电脑，充好电；手机也带上。</p>
                    <details>
                      <summary className="body-sm">再看一下转账信息</summary>
                      <div className="stack-2" style={{ marginTop: "var(--space-3)" }}>
                        <p style={{ margin: 0 }}>转账金额：{COURSE.payLabel} · 转账备注：<strong className="mono">{order.ref}</strong></p>
                        {paymentInfo && <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>}
                      </div>
                    </details>
                  </div>
                                ) : (
                  <>
                    <div className="card card--accent stack-3">
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账金额：<strong>{COURSE.payLabel}</strong>
                      </p>
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账备注填：<strong className="mono" style={{ fontSize: "1.4rem" }}>{order.ref}</strong>
                      </p>
                      {paymentInfo ? (
                        <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>
                      ) : (
                        <p className="body" style={{ margin: 0 }}>
                          转账信息请私信 James 获取（<a href="/#contact">微信二维码</a>）。
                        </p>
                      )}
                    </div>
                    <form method="post" action="/api/course/claim">
                      <input type="hidden" name="ref" value={order.ref} />
                      <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                        我已经转账了
                      </button>
                    </form>
                    <p className="body">
                      转完点上面的按钮，再把截图发给 James 的微信（<a href="/#contact">James 的微信二维码在这里</a>），我们核对后会把你拉进学员群。这个页面可以截图保存，备注编号别填错。
                    </p>
                  </>
                )}

                <p className="body">
                  时间：{COURSE.dateLabel}，{COURSE.timeLabel}
                  <br />
                  地点：{COURSE.placeLabel}
                </p>
              </div>
            ) : (
              // ── Not signed up yet ─────────────────────────────────────
              // Laid out like a product page (2026-10-19): one line of what it
              // is, the offer as an equation, then features as cards. Detail
              // that only some people want sits in <details> rather than in
              // the scroll.
              <>
                <div className="vip-hero">
                  <div className="stack-4">
                    <span className="eyebrow">§ Vibe Thursday 共创会员 · 一年</span>
                    <h1>看懂 AI 商机，让生意更进一步</h1>
                    <p className="body-lg">
                      悉尼华人生意人的 AI 落地圈子。从 {COURSE.dateLabel}的「{COURSE.title}」开始，带走一个懂你生意的 AI 商业顾问。
                    </p>
                    <p className="vip-eq">
                      <strong>{COURSE.priceLabel}</strong>
                      <span aria-hidden="true">＝</span>
                      <span>一堂 4 小时实战课</span>
                      <span aria-hidden="true">＋</span>
                      <span>一年共创会员</span>
                    </p>
                    <ul className="vip-facts">
                      <li><Icon name="calendar" />10/25 周日 9:00–13:00</li>
                      <li><Icon name="pin" />St Leonards</li>
                      <li><Icon name="laptop" />不用懂技术，带笔记本电脑</li>
                    </ul>
                    <a className="btn btn--primary" href="#class-signup" style={{ alignSelf: "flex-start" }}>报名入会 ↓</a>
                  </div>
                  {/* The same poster that goes out in the group and on Moments, so the
                      page and the picture never say different things. */}
                  <figure className="stack-2" style={{ margin: 0 }}>
                    <a className="class-poster" href="/class/poster-2026-10-25.jpg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/class/poster-2026-10-25.webp"
                        width={1080}
                        height={1440}
                        alt="Vibe Thursday 共创会员海报：599 澳元 = 10/25 一堂 4 小时实战课 + 一年共创会员"
                      />
                    </a>
                    <figcaption className="hint">点开看大图，长按保存、转发给做生意的朋友。</figcaption>
                  </figure>
                </div>

                <div className="stack-4">
                  <h2>加入以后，你会得到</h2>
                  <div className="feature-grid">
                    {FEATURES.map((feature) => (
                      <article className={feature.hot ? "feature feature--hot" : "feature"} key={feature.title}>
                        <span className="feature__icon"><Icon name={feature.icon} /></span>
                        <h3 className="feature__title">{feature.title}</h3>
                        <p className="feature__body">{feature.body}</p>
                      </article>
                    ))}
                  </div>
                  <p className="hint" style={{ margin: 0 }}>社群产生的收益，用在社群活动和对大家的激励上。</p>
                </div>

                {/* The bonus is written with its limits on purpose: a one-page site
                    is cheap to make for everyone; an existing complex site is not. */}
                <div className="grid-2">
                  <article className="feature feature--hot">
                    <span className="feature__icon"><Icon name="globe" /></span>
                    <h3 className="feature__title">★ 前 15 名加送：一页式官网并上线</h3>
                    <p className="feature__body">
                      一页介绍你的生意、服务和联系方式，用你自己的域名（域名你买，我们帮你接上），课后两周内上线。已经有官网的，给你改进建议，不重做。按转账到账先后算。
                    </p>
                  </article>
                  <article className="feature">
                    <span className="feature__icon"><Icon name="gift" /></span>
                    <h3 className="feature__title">另送：一年 AI 创始人 IP 会员（价值 365 澳元）</h3>
                    <p className="feature__body">学用 AI 做自媒体、做内容获客，让更多人认识你。</p>
                    <details>
                      <summary className="body-sm">包括什么</summary>
                      <ul className="body-sm" style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.2em" }}>
                        <li>全年不少于 6 场线下公开课：用 AI 做自媒体内容、获客</li>
                        <li>会员专属线下活动和聚会；周四局会员专属留位</li>
                        <li>一年会员群：AI 资讯和答疑；知识星球资料库</li>
                        <li>会员专属 AI 智能体，一年使用权</li>
                      </ul>
                    </details>
                  </article>
                </div>

                <div className="stack-4">
                  <div className="stack-2">
                    <span className="eyebrow">§ 入会第一课 · {COURSE.dateLabel}</span>
                    <h2>{COURSE.title}</h2>
                    <p className="body-lg">不讲空泛概念，带着你自己的生意来，4 小时边学边练。每一段都动手，走的时候东西在你手上。</p>
                  </div>
                  <ol className="timeline">
                    {OUTLINE.map((step) => (
                      <li key={step.time}>
                        <span className="timeline__time mono">{step.time}</span>
                        <div>
                          <strong>{step.title}</strong>
                          {step.body && <p className="body-sm" style={{ margin: 0 }}>{step.body}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <details className="card">
                    <summary><strong>举个例子：一位做装修的老板，这一上午做了什么</strong></summary>
                    <ul className="stack-2" style={{ margin: "var(--space-3) 0 0", paddingLeft: "1.3em" }}>
                      <li><strong>原来</strong>：客人在微信、小红书里问「多少钱一平」「多久完工」，白天在工地顾不上，晚上一条条回，回慢了客人就去问别家</li>
                      <li><strong>课上做成</strong>：一张需求单。交给 AI 的是回新客人的第一轮咨询；资料是价格区间、案例和常见问答；报价、工期和折扣必须他拍板，AI 只起草</li>
                      <li><strong>回去以后</strong>：客人问题贴给助理，它出草稿，他看一眼再发。想做成自动回复，拿着需求单去找人做，可以直接开工</li>
                    </ul>
                    <p className="hint" style={{ margin: "var(--space-2) 0 0" }}>课上用的示范，不是真实客户。</p>
                  </details>
                </div>

                <div className="grid-2">
                  <div className="card stack-2">
                    <h3 className="h3">适合你，如果</h3>
                    <ul className="checklist">
                      <li>自己做生意：房产、贷款、装修、餐饮、门店、电商外贸、教育咨询都行</li>
                      <li>听过 AI、可能也用过，但生意还是老样子</li>
                      <li>会用微信、会打字就够了，不写代码</li>
                    </ul>
                  </div>
                  <div className="card stack-2">
                    <h3 className="h3">主讲 James</h3>
                    <p style={{ margin: 0 }}>
                      零员工，一个人运营数十款面向海外市场的软件产品，用 AI 把软件生意做到了七位数年营收。悉尼每周四 AI 聚会 Vibe Thursday 主办人，每周和各行业老板聊 AI 怎么落地。
                    </p>
                    <p className="hint" style={{ margin: 0 }}>已经自己在写代码、做 AI 产品的朋友，这门课偏入门，周二研讨会更适合你。</p>
                  </div>
                </div>

                <div className="stack-3">
                  <h2 className="h3">常见问题</h2>
                  {FAQ.map((item) => (
                    <details className="faq" key={item.q}>
                      <summary>{item.q}</summary>
                      <p style={{ margin: "var(--space-2) 0 0" }}>{item.a}</p>
                    </details>
                  ))}
                </div>

                <div className="card card--accent stack-6 vip-signup">
                <h2 id="class-signup">报名入会</h2>
                <p className="body-lg">
                  第一课：{COURSE.dateLabel}，{COURSE.timeLabel}
                  <br />
                  地点：{COURSE.placeLabel}
                  <br />
                  入会：{COURSE.priceLabel}（一年），银行转账
                  <br />
                  席位有限，报满即止
                </p>

                {error && <p className="alert" role="alert">{error}</p>}

                <p className="body" style={{ color: "var(--fg3)" }}>
                  已经报过名、找不到转账信息了？用同一个微信号再填一次，会显示你原来那条。
                </p>

                <form method="post" action="/api/course" className="stack-6">
                  {knownName ? (
                    <div className="stack-2">
                      <input type="hidden" name="self" value="1" />
                      <p className="body-lg" style={{ margin: 0 }}>
                        ✓ 已认出你：<strong>{knownName}</strong>，名字和微信号不用再填。
                      </p>
                      <a className="body" href="/class?other=1">不是我？帮别人报名点这里</a>
                    </div>
                  ) : (
                    <>
                      {loginHref && (
                        <div className="stack-3">
                          <a className="btn btn--wechat btn--block" href={loginHref}>
                            <WeChatMark />
                            报过周四局？用微信登录，不用再填
                          </a>
                          <p className="or-divider" style={{ margin: 0 }}>或者直接填写</p>
                        </div>
                      )}
                      <div>
                        <label className="label" htmlFor="class-name">名字</label>
                        <input className="field" id="class-name" name="name" required autoComplete="name" maxLength={60} />
                      </div>
                      <div>
                        <label className="label" htmlFor="class-wechat">微信号（或手机号）</label>
                        <input className="field" id="class-wechat" name="wechat" required autoCapitalize="off" autoCorrect="off" maxLength={60} />
                        <p className="hint">微信号在：微信 → 我 → 头像右边「微信号：」后面那串，不是昵称。不知道的话填手机号也行。</p>
                      </div>
                    </>
                  )}

                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="label">最想让 AI 帮你哪一块？（选填，可多选）</legend>
                    <div className="choice-group">
                      {BIZ_FOCUS_OPTIONS.map((option) => (
                        <label className="choice" key={option.value}>
                          <input type="checkbox" name="biz_focus" value={option.value} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label className="label" htmlFor="class-industry">你在哪个行业？（选填）</label>
                    <select className="field" id="class-industry" name="industry" defaultValue="">
                      <option value="">（跳过）</option>
                      {INDUSTRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="class-note">你的生意里，具体哪件事最想交给 AI？（选填）</label>
                    <textarea className="field" id="class-note" name="note" maxLength={500} placeholder="比如：每天回客人微信太花时间；房源文案写不过来" />
                    <p className="hint">写得越具体，课上越能对着你的事讲。</p>
                  </div>

                  <div>
                    <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                      报名，看转账信息
                    </button>
                  </div>
                </form>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
