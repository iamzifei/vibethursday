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
                  <p className="body-lg">40 个名额已经满了。有人退出，我们会按顺序微信联系你，先不用转账。</p>
                ) : order.status === "paid" ? (
                  <p className="body-lg">已经收到你的转账了，10 月 18 日见。</p>
                ) : (
                  <>
                    <div className="card card--accent stack-3">
                      <p className="body-lg" style={{ margin: 0 }}>
                        金额：<strong>{COURSE.priceLabel}</strong>
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
                  <span className="eyebrow">§ 收费小班 · {COURSE.dateLabel}</span>
                  <h1>{COURSE.title}</h1>
                  <p className="body-lg">
                    给听过 AI、但还不知道它在自己生意里能干什么的老板。不讲概念，带着你自己的生意来。
                  </p>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">你会得到</h2>
                  <ol className="stack-2" style={{ margin: 0, paddingLeft: "1.3em" }}>
                    <li><strong>你的私人 AI 经营助理</strong>：这个月钱为什么少了、客人从哪来、这单该不该接，随时问它，帮你把问题一步步理清楚</li>
                    <li><strong>一份需求单</strong>：把你最想交给 AI 的事写清楚——哪件事、现在谁在做、每周花多少时间、做成什么样算好，课上一起写</li>
                    <li><strong>一对一专属咨询 15 分钟</strong>：线上，只看你的生意和你的需求单，别人不在场。需要提前预约，没约的不安排</li>
                    <li><strong>免费定制交付</strong>：从大家的需求单里抽取一部分，专门为你的生意开发一个 AI 工具，做好交到你手上（抽中名额会考虑需求大小，以实际评估为准）</li>
                  </ol>
                </div>

                <div className="card stack-3">
                  <h2 className="h3">报名送一年 AI 创始人 IP 会员（单买 365 澳元）</h2>
                  <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.3em" }}>
                    <li>全年不少于 6 场线下公开课，讲怎么用 AI 做自媒体 IP</li>
                    <li>知识星球资料库，一直在更新</li>
                    <li>周四局会员席：每周另外加位子给会员，不占公开名额</li>
                  </ul>
                </div>

                <p className="body-lg">
                  时间：{COURSE.dateLabel}，{COURSE.timeLabel}
                  <br />
                  地点：{COURSE.placeLabel}
                  <br />
                  费用：{COURSE.priceLabel}，银行转账
                  <br />
                  名额：{COURSE.cap} 个
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
