import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WeChatMark } from "@/components/WeChatMark";
import { currentAccount } from "@/lib/account";
import { getCopy } from "@/lib/content";
import { COURSE, looksLikeCourseRef } from "@/lib/course";
import { getCourseOrderByRef, getSignupProfile } from "@/lib/db";
import { wechatLoginHref } from "@/lib/login-link";

// Who is asking changes the form, and a reference changes the whole page.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ ref?: string; err?: string; other?: string }>;
};

export const metadata: Metadata = {
  title: `${COURSE.title} · Vibe Thursday`,
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
          <div className="shell stack-8" style={{ maxWidth: "680px", fontSize: "1.1rem" }}>
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
                        : "报上了，最后一步：转账"}
                  </h1>
                </div>

                {order.status === "cancelled" ? (
                  <p className="body-lg">这条报名已经取消了，不用转账。想重新报名，回到报名页再填一次就行。</p>
                ) : order.status === "waitlist" ? (
                  <p className="body-lg">名额已经满了。有人退出，我们会按顺序微信联系你，先不用转账。</p>
                ) : order.status === "paid" ? (
                  <p className="body-lg">已经收到你的转账了，{COURSE.dateLabel}见。</p>
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
                    <p className="body-lg">
                      转完把截图发给 James 的微信就行（<a href="/#contact">James 的微信二维码在这里</a>），我们核对后会把你拉进学员群。这个页面可以截图保存，备注编号别填错。
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
              <>
                <div className="stack-4">
                  <span className="eyebrow">§ 精品小班课 · {COURSE.dateLabel}</span>
                  <h1>{COURSE.title}</h1>
                  <p className="body-lg">
                    给听过 AI、但不知道它在自己生意里能干什么的老板。不讲概念，带着你自己的生意来。
                  </p>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">周四局的老板们报名时，问得最多的是这几件事</h2>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li>AI 到底怎么和我的生意结合起来？</li>
                    <li>每天的杂事，能不能交给 AI，让我从小事里脱身？</li>
                    <li>客人从哪来？生意刚起步，怎么让客人相信我们？</li>
                    <li>能不能有一个 AI 客服，帮我回客人消息？</li>
                  </ul>
                  <p style={{ margin: 0 }}>这门课就是冲着这些问题来的。</p>
                </div>

                <div className="stack-4">
                  <h2 className="h3">你会得到</h2>

                  <div className="card stack-2">
                    <h3 className="h3" style={{ fontSize: "1.15em" }}>1　一个懂你生意的私人 AI 助理</h3>
                    <p style={{ margin: 0 }}>
                      课上装到你的手机上。先告诉它你做什么生意、客人是谁、现在最头疼的事。
                    </p>
                    <p style={{ margin: 0 }}>
                      之后可以问它：这个月生意为什么差了？它不会马上给你一个答案，会先问你：是来的客人少了，每个客人买得少了，还是价格变了？一步步帮你找到原因。也可以问：我的客人主要从哪来？怎么让第一次来的客人信我？
                    </p>
                  </div>

                  <div className="card stack-2">
                    <h3 className="h3" style={{ fontSize: "1.15em" }}>2　一张需求单</h3>
                    <p style={{ margin: 0 }}>
                      很多老板说「帮我弄个 AI」。这句话谁都没法开工，因为不知道要做什么。
                    </p>
                    <p style={{ margin: 0 }}>
                      课上你挑一件最想交给 AI 的事，回客人消息、整理客户资料、做内容都行。助理会一格一格问你：这件事现在谁在做？每周花多少时间？做成什么样算好？答完，就是一张需求单。以后不管找谁做 AI，都用得上。
                    </p>
                  </div>

                  <div className="card stack-2">
                    <h3 className="h3" style={{ fontSize: "1.15em" }}>3　限时一对一专属咨询（每人 15 分钟）</h3>
                    <p style={{ margin: 0 }}>
                      课后在线上，只有你和我。带着你的需求单，和用助理时卡住的地方来。你的生意、你的数据，别人听不到。
                    </p>
                    <p style={{ margin: 0 }}>需要提前预约，没约的不安排。</p>
                  </div>

                  <div className="card stack-2">
                    <h3 className="h3" style={{ fontSize: "1.15em" }}>4　彩蛋：你的刚需，我们免费做出来</h3>
                    <p style={{ margin: 0 }}>
                      课后我们会看每一张需求单，挑出几份，免费做成你生意里能直接用的 AI 工具，比如自动回客人消息的客服助手、帮你整理资料的小工具。做好交到你手上，教会你怎么用。
                    </p>
                    <p style={{ margin: 0 }}>我们怎么挑：</p>
                    <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                      <li>写得清楚：六格都填了，谁在做、花多久、做成什么样算好，一看就懂</li>
                      <li>是刚需：每天都在花时间，很多老板都有这个麻烦</li>
                      <li>能尽快做出来：太大的需求，我们会在一对一里跟你说怎么拆</li>
                    </ul>
                  </div>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">当天大致安排</h2>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                    <li><strong>9:00</strong>　开始：先弄清楚 AI 能干什么、不能干什么</li>
                    <li><strong>9:40</strong>　装好你的 AI 助理，用你自己的生意问它</li>
                    <li><strong>10:40</strong>　茶歇</li>
                    <li><strong>11:00</strong>　写你的需求单</li>
                    <li><strong>12:00</strong>　交给 AI 之前要注意的事：客人隐私、对客人的承诺</li>
                    <li><strong>12:20</strong>　一对一咨询怎么约、彩蛋怎么挑、会员有哪些权益</li>
                    <li><strong>12:40</strong>　答疑、合影</li>
                    <li><strong>13:00</strong>　结束</li>
                  </ul>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">要准备什么</h2>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li>手机充好电。课上用手机，不用带电脑</li>
                    <li>想好你生意里最头疼的一件事</li>
                    <li>想拿来练的客人聊天截图或单据可以带上，客人的姓名和电话先遮掉</li>
                  </ul>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">报名送一年 AI 创始人 IP 会员（价值 365 澳元）</h2>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em", listStyle: "disc" }}>
                    <li>全年不少于 6 场线下公开课，讲怎么用 AI 做自媒体 IP</li>
                    <li>会员专属线下活动和聚会</li>
                    <li>周四局会员专属留位</li>
                    <li>一年会员群：AI 资讯和答疑</li>
                    <li>知识星球资料库，一直在更新</li>
                    <li>会员专属 AI 智能体，一年使用权</li>
                  </ul>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">常见问题</h2>
                  <div className="stack-3">
                    <p style={{ margin: 0 }}><strong>我完全不懂 AI，能跟上吗？</strong><br />能。每一步都在手机上跟着做，卡住了举手，我们过来帮你。</p>
                    <p style={{ margin: 0 }}><strong>要带电脑吗？</strong><br />不用，手机就行。</p>
                    <p style={{ margin: 0 }}><strong>用中文上课吗？</strong><br />是，全程中文。</p>
                    <p style={{ margin: 0 }}><strong>我生意上的事，会被其他人听到吗？</strong><br />课上的练习在你自己的手机上做。具体的生意问题，留到一对一咨询里说，只有你和我。</p>
                  </div>
                </div>

                <p className="body-lg">
                  时间：{COURSE.dateLabel}，{COURSE.timeLabel}
                  <br />
                  地点：{COURSE.placeLabel}
                  <br />
                  费用：{COURSE.priceLabel}，银行转账
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
                    <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                      报名，看转账信息
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
