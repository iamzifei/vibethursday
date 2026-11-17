import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WeChatMark } from "@/components/WeChatMark";
import { Celebration } from "@/components/Celebration";
import { SceneImage } from "@/components/SceneImage";
import { StickyCta } from "@/components/StickyCta";
import { CLASS_SCENES } from "@/lib/scenes";
import { currentAccount } from "@/lib/account";
import { getCopy } from "@/lib/content";
import { COURSE, IP_COURSE, IP_COURSE_1115, looksLikeCourseRef, REFRESHER } from "@/lib/course";
import { getCourseOrderByRef, getSignupProfile } from "@/lib/db";
import { wechatLoginHref } from "@/lib/login-link";

// Who is asking changes the form, and a reference changes the whole page.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ ref?: string; err?: string; other?: string; done?: string }>;
};

export const metadata: Metadata = {
  title: `${IP_COURSE.title} · Vibe Thursday`,
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

type IconName = "advisor" | "list" | "laptop" | "tool" | "handshake" | "people" | "globe" | "gift" | "calendar" | "pin" | "camera";

/**
 * The AI+IP class (`IP_COURSE`, 12/13), laid out from the poster James sent on
 * 2026-11-18 — headline, the three promises, the three modules, the hands-on
 * shoot, venue, price — without its QR code (payment stays a bank transfer).
 * Only what the poster says: no times per module, no promises it does not make.
 */
const PROMISES = [
  { strong: "用好", em: "AI" },
  { strong: "打造", em: "IP" },
  { strong: "让生意", em: "更好做" },
];

/** The day's three modules, in the poster's order: who, an optional line about them, what. */
const MODULES: { who: string; tag?: string; what: string }[] = [
  { who: "悉尼妈妈 Lankey", what: "个人 IP 打造" },
  { who: "特邀嘉宾：澳骄哥", tag: "全网 300 万+ 粉丝", what: "自媒体实战分享" },
  { who: "澳洲 AI 教父 James", what: "AI 应用实战" },
];

/** The assistants named on the poster. */
const ASSISTANTS = ["Nick", "阿利", "楚楚"];

/** 「含一年课程会员权益」: what the price buys besides the day (James 2026-11-18: still included). */
const REFRESH: { icon: IconName; text: string }[] = [
  { icon: "calendar", text: "全年不少于 6 次复训机会" },
  { icon: "gift", text: `复训留位费：${REFRESHER.priceLabel} / 次` },
  { icon: "people", text: "学员群交流" },
  { icon: "list", text: "复训日期、主题及预约安排提前通知" },
];

const FAQ: { q: string; a: string }[] = [
  { q: "适合我吗？", a: "老板、创业者、自媒体新手都欢迎。" },
  { q: "699 包含什么？", a: "12 月 13 日这一整天的课（含午餐），加一年课程会员权益：全年不少于 6 次复训，每次付 40 澳元（含 GST）留位；还有学员群。复训的日期、主题和预约安排会提前通知。" },
  { q: "我上过之前的课（10 月 25 日或 11 月 15 日），还要付 699 吗？", a: "不用。上过课的同学来这一期算复训，只付 40 澳元（含 GST）留位费。用上次报课时的微信号报名，页面会自动按复训显示转账金额；对不上的话私信 James。" },
  { q: "我是共创会员，要付钱吗？", a: "11 月 5 日前办的共创会员（一年那种），如果还没上过任何一期课，这一期免费：用报名周四时的微信登录，再点报名，就直接确认了，不用转账。已经上过课的共创会员，这一期算复训，付 40 澳元（含 GST）留位费。之后办的 4 周会员不含这门课。" },
  { q: "安排会变吗？", a: "具体时间和安排以最终通知为准。" },
];

/** Every section opens the same way: a number, the heading, and at most one line. */
function SectionHead({ n, title, lead }: { n: string; title: string; lead?: string }) {
  return (
    <div className="vip-head">
      <span className="vip-head__n mono">{n}</span>
      <h2>{title}</h2>
      {lead && <p className="vip-lead">{lead}</p>}
    </div>
  );
}

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
    camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
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
  // An order from an earlier class still opens on its own dates and amount.
  const course = order?.course === COURSE.id ? COURSE : order?.course === IP_COURSE_1115.id ? IP_COURSE_1115 : IP_COURSE;
  // Someone who has already taken a class pays only the refresher fee for this one.
  const refresher = course === IP_COURSE && Boolean(order?.refresher);
  const payLabel = refresher ? REFRESHER.payLabel : course.payLabel;

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
          <div className="shell stack-8" style={{ maxWidth: "640px", fontSize: "1.05rem" }}>
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
                  <p className="body-lg">名额已确认，{course.dateLabel}见。</p>
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
                      <h2 className="h3">{course.dateLabel}之前，你可以先做一件事</h2>
                      <p style={{ margin: 0 }}>
                        想一想：你希望通过内容，让什么样的客户找到你。那天我们就从这里开始。
                      </p>
                    </div>
                    <p className="body" style={{ margin: 0 }}>建议带上手机和笔记本电脑，充好电。</p>
                    <details>
                      <summary className="body-sm">再看一下转账信息</summary>
                      <div className="stack-2" style={{ marginTop: "var(--space-3)" }}>
                        <p style={{ margin: 0 }}>转账金额：{payLabel} · 转账备注：<strong className="mono">{order.ref}</strong></p>
                        {paymentInfo && <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>}
                      </div>
                    </details>
                  </div>
                                ) : (
                  <>
                    <div className="card card--accent stack-3">
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账金额：<strong>{payLabel}</strong>
                      </p>
                      {refresher && (
                        <p className="body" style={{ margin: 0 }}>你上过之前的课，这一期算复训，只付留位费。</p>
                      )}
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账备注填：<strong className="mono" style={{ fontSize: "1.4rem" }}>{order.ref}</strong>
                      </p>
                      {paymentInfo ? (
                        <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>
                      ) : (
                        <p className="body" style={{ margin: 0 }}>
                          转账信息请私信 James 获取（<Link href="/#contact">微信二维码</Link>）。
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
                      转完点上面的按钮，再把截图发给 James 的微信（<Link href="/#contact">James 的微信二维码在这里</Link>），我们核对后会把你拉进学员群。这个页面可以截图保存，备注编号别填错。
                    </p>
                    {course === IP_COURSE && !refresher && (
                      <p className="body">11 月 5 日前办的共创会员、还没上过课的不用转账：私信 James，他在后台帮你确认。</p>
                    )}
                  </>
                )}

                <p className="body">
                  时间：{course.dateLabel}，{course.timeLabel}
                  <br />
                  地点：{course.placeLabel}
                </p>
              </div>
            ) : (
              // ── Not signed up yet ─────────────────────────────────────
              // Phone first (2026-10-19 redesign): one narrow column, every
              // section the same shape — number, heading, one line, content —
              // with the same space between them. No cards inside cards.
              <>
                <header className="vip-hero ip-hero">
                  <span className="eyebrow">§ Vibe Thursday</span>
                  <h1 className="ip-hero__title">澳洲 AI+IP<br />实战课</h1>
                  <p className="ip-hero__tag">自媒体人的黄埔军校 · AI 获客类短视频</p>
                  <ul className="ip-promises" aria-label="这门课的三件事">
                    {PROMISES.map((p) => (
                      <li key={p.strong}>{p.strong}<em>{p.em}</em></li>
                    ))}
                  </ul>
                  <div className="vip-offer">
                    <p className="vip-offer__price">AUD $699</p>
                    <p className="vip-offer__eq">含午餐 · 含一年课程会员权益</p>
                    <ul className="vip-offer__facts">
                      <li><Icon name="calendar" />2026 年 12 月 13 日（周日）· 悉尼</li>
                      <li><Icon name="calendar" />09:00–17:00</li>
                      <li><Icon name="pin" />唐宴 King Dynasty · Moore Park</li>
                    </ul>
                    <a className="btn btn--primary btn--block" href="#class-signup">报名</a>
                    <p className="vip-offer__left">上过之前课程的同学算复训，只付 40 澳元留位费</p>
                  </div>
                </header>

                <figure className="stack-2" style={{ margin: 0 }}>
                  <SceneImage id="class-1" alt="上一期课程现场，教室坐满" eager />
                  <figcaption className="hint">{CLASS_SCENES[0].zh}（现场照片转绘，人物的脸都换掉了）</figcaption>
                </figure>

                <section className="vip-section">
                  <SectionHead n="01" title="课程表" lead="2026 年 12 月 13 日（周日）09:00–17:00 · 悉尼 Moore Park" />
                  <ol className="ip-modules">
                    {MODULES.map((m, i) => (
                      <li key={m.who}>
                        <span className="ip-modules__n mono">{String(i + 1).padStart(2, "0")}</span>
                        <div>
                          <p className="ip-modules__who">{m.who}</p>
                          {m.tag && <p className="ip-modules__tag">{m.tag}</p>}
                          <p className="ip-modules__what">{m.what}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="body" style={{ margin: 0 }}>助教：{ASSISTANTS.join(" · ")}</p>
                  <div className="card card--accent stack-2">
                    <h3 className="h3" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", margin: 0 }}>
                      <Icon name="camera" />实拍实操环节
                    </h3>
                    <p style={{ margin: 0 }}>摄影摄像现场拍摄 · 实战拍摄与 AI 剪辑</p>
                  </div>
                  <p className="vip-note">具体时间和安排以最终通知为准。</p>
                </section>

                <section className="vip-section">
                  <SectionHead n="02" title="含一年课程会员权益" lead="AUD $699，包含这一天的课和一年的课程会员权益。" />
                  <ul className="vip-features">
                    {REFRESH.map((item) => (
                      <li key={item.text}>
                        <span className="vip-features__icon"><Icon name={item.icon} /></span>
                        <div>
                          <h3>{item.text}</h3>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="vip-section">
                  <SectionHead n="03" title="上课地点" lead="公共交通便利，方便停车。" />
                  <p className="body-lg" style={{ margin: 0 }}>
                    <strong>唐宴 King Dynasty</strong>
                    <br />
                    Level 1, Building 215-S1, 125 Lang Rd, Moore Park NSW 2021
                  </p>
                  <p className="vip-note">活动协办与餐食赞助：唐宴，赞助精美午餐。</p>
                </section>

                <section className="vip-section">
                  <SectionHead n="04" title="不是新开的网课，是每周都在的线下圈子" lead="上一期 10 月 25 日的现场，照片转绘，人物的脸都换掉了。" />
                  <div className="scene-strip" role="region" aria-label="上一期课程现场" tabIndex={0}>
                    {CLASS_SCENES.slice(1).map((scene) => (
                      <figure key={scene.id}>
                        <SceneImage id={scene.id} alt="" sizes="(min-width: 720px) 330px, 85vw" />
                        <figcaption className="hint">{scene.zh}</figcaption>
                      </figure>
                    ))}
                  </div>
                  <dl className="vip-stats">
                    <div><dt>已办周四聚会</dt><dd>11 场</dd></div>
                    <div><dt>每场到场</dt><dd>40–70 人</dd></div>
                  </dl>
                  <p className="vip-note">截至 10 月。</p>
                  <div className="vip-speaker">
                    <p className="vip-speaker__label">主讲之一</p>
                    <p className="vip-speaker__name">James</p>
                    <p>零员工，一个人运营数十款面向海外市场的软件产品，用 AI 把软件生意做到了七位数年营收。悉尼每周四 AI 聚会 Vibe Thursday 主办人，每周和各行业老板聊 AI 怎么落地。</p>
                  </div>
                </section>

                <section className="vip-section">
                  <SectionHead n="05" title="常见问题" />
                  <div className="vip-faq">
                    {FAQ.map((item) => (
                      <details key={item.q}>
                        <summary>{item.q}</summary>
                        <p>{item.a}</p>
                      </details>
                    ))}
                  </div>
                </section>

                {/* Phones: the price and the way in, always one tap away. */}
                <StickyCta href="#class-signup" label="AUD $699" cta="报名" />

                <div className="card card--accent stack-6 vip-signup" id="class-signup">
                <h2>报名</h2>
                <p className="body-lg">
                  时间：{IP_COURSE.dateLabel}，{IP_COURSE.timeLabel}
                  <br />
                  地点：{IP_COURSE.placeLabel}
                  <br />
                  费用：{IP_COURSE.priceLabel}（含午餐和一年课程会员权益），银行转账
                  <br />
                  上过之前课程的同学算复训，付 {REFRESHER.priceLabel} 留位费；11 月 5 日前办的共创会员、还没上过课的免费
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
                    <label className="label" htmlFor="class-note">你最想用内容解决什么问题？（选填）</label>
                    <textarea className="field" id="class-note" name="note" maxLength={500} placeholder="比如：想让更多本地客户找到我；不知道自己该怎么定位" />
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
