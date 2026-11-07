import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WeChatMark } from "@/components/WeChatMark";
import { SceneImage } from "@/components/SceneImage";
import { StickyCta } from "@/components/StickyCta";
import { SCENES } from "@/lib/scenes";
import { currentAccount } from "@/lib/account";
import { settleIfPaid } from "@/lib/card-pay";
import { getCopy } from "@/lib/content";
import { formatSession, upcomingOpenTrial } from "@/lib/sessions";
import { cohortDatesLabel, cohortForPayment, cohortOnSale, MEMBERSHIP, YEARLY_MEMBERSHIP_ID, looksLikeMemberRef } from "@/lib/course";
import { getCourseOrderByRef, getSignupProfile, isMember } from "@/lib/db";
import { wechatLoginHref } from "@/lib/login-link";
import { stripeEnabled } from "@/lib/stripe-pay";

export const dynamic = "force-dynamic";

// In the nav since the second round of 2026-11-02 (it began unlisted).
// A page opened by its reference is someone's own order: kept out of search.
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { ref } = await searchParams;
  return {
    title: "共创会员 · Vibe Thursday",
    description: "Vibe Thursday 共创会员：599 澳元一期 4 周，一次付清。4 个周二上午线上看 James 用 AI 现场做一个真实的产品。",
    ...(ref ? { robots: { index: false } } : {}),
  };
}

type PageProps = { searchParams: Promise<{ ref?: string; paid?: string; error?: string; err?: string; other?: string }> };

/**
 * What the 4-week membership gives (2026-11-05), shown before and after
 * paying. No AI+IP class: that was part of the yearly membership only.
 */
const PERKS = [
  "一期 4 个周二的线上 Build Tuesday，10:30–12:00（悉尼时间）：看 James 用 AI 现场做一个真实的产品，也讲哪些产品能赚钱",
  "每周二开始前，我会拉一个临时微信群，Zoom 链接发在群里",
  "成员墙和个人页上的「共创会员」标",
];

/**
 * What people said, in their words, without names (2026-11-02). From messages
 * sent to the organiser; trimmed, not reworded.
 */
const TESTIMONIALS = [
  {
    text: "面试时和面试官聊到我们这个疯狂星期四，他对 AI 很感兴趣，问了很多 follow-up question，我就把在这里听来的经验都说了。第二天就收到了 offer call。跳出学生思维的第一堂课。",
    who: "一位参加过周四的同学",
  },
];

const ERRORS: Record<string, string> = {
  missing: "名字和微信号都要填。",
  rate: "试太多次了，过一会儿再来。",
  failed: "没保存成功，请再试一次；还不行就私信 James。",
  member: "这个微信号已经是共创会员了，不用再买。",
  closed: "这一期已经结束，下一期日期待定。",
};

/**
 * The 共创会员 on its own (2026-11-02, course.ts MEMBERSHIP): what it gives,
 * name and WeChat ID, then straight to Stripe. Since 2026-11-05 it sells one
 * 4-week cohort, paid once; with no upcoming cohort set (`cohortOnSale`) the
 * page says the next date is still to be decided and offers no payment.
 * Back from Stripe — or opened later by its reference — the page settles the payment if the webhook has
 * not yet, and says whether it went through. Chinese only, like /class.
 */
export default async function JoinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const c = getCopy("zh");
  const trialDate = upcomingOpenTrial();
  const ref = looksLikeMemberRef(params.ref) ? params.ref : null;
  let order = ref ? await getCourseOrderByRef(ref).catch(() => null) : null;
  // A yearly order bought before 2026-11-05 still opens here, to show it is paid.
  if (order && order.course !== MEMBERSHIP.id && order.course !== YEARLY_MEMBERSHIP_ID) order = null;
  if (ref && order && (await settleIfPaid("member", order))) order = await getCourseOrderByRef(ref).catch(() => null);

  let knownName: string | null = null;
  let alreadyMember = false;
  if (!order && params.other !== "1") {
    const account = await currentAccount();
    if (account) {
      try {
        const profile = await getSignupProfile(account.signupId);
        if (profile?.wechat) knownName = profile.name;
        alreadyMember = await isMember(account.signupId);
      } catch (error) {
        console.error("[join] could not read the recognised signup", error);
      }
    }
  }
  const loginHref = wechatLoginHref("/join", null);
  const onSale = cohortOnSale();
  // The cohort a paid 4-week order belongs to, for the welcome line.
  const paidCohort = order?.status === "paid" && order.course === MEMBERSHIP.id && order.paid_at ? cohortForPayment(new Date(order.paid_at)) : null;
  const error = params.err && Object.hasOwn(ERRORS, params.err) ? ERRORS[params.err] : null;

  const perks = (
    <ul className="stack-2" style={{ margin: 0 }}>
      {PERKS.map((perk) => <li key={perk}>{perk}</li>)}
    </ul>
  );

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path="/join" />
      <main id="main">
        <section className="section">
          <div className="shell stack-6" style={{ maxWidth: "640px", fontSize: "1.05rem" }}>
            {order ? (
              <>
                <div className="stack-3">
                  <span className="eyebrow">§ {MEMBERSHIP.title}</span>
                  <h1>{order.status === "paid" ? `${order.name}，欢迎加入！` : "最后一步：付款"}</h1>
                </div>
                {order.status === "paid" ? (
                  <>
                    <p className="body-lg">
                      {order.course === YEARLY_MEMBERSHIP_ID
                        ? "付款已确认。这是 11 月 5 日前办的一年会员，从付款日起一年内有效。"
                        : paidCohort
                          ? `付款已确认。你在第 ${paidCohort.number} 期：${cohortDatesLabel(paidCohort)}，每次周二 10:30–12:00。`
                          : "付款已确认。"}
                    </p>
                    {/* The perks listed are the 4-week ones; a yearly order keeps its own. */}
                    {order.course !== YEARLY_MEMBERSHIP_ID && perks}
                    <p className="body">
                      付款编号 <strong className="mono">{order.ref}</strong>，有问题私信 James 时带上它。报周二时用同一个微信号，网站就认得你是会员。
                    </p>
                  </>
                ) : (
                  <>
                    {params.paid && <p className="body-lg">付款正在确认，过几秒刷新这一页就会显示「欢迎加入」。</p>}
                    {params.error && <p className="alert" role="alert">付款页没打开，请再点一次；还不行就私信 James。</p>}
                    <div className="card card--accent stack-3">
                      <p className="body-lg" style={{ margin: 0 }}>
                        金额：<strong>{MEMBERSHIP.payLabel}</strong>
                      </p>
                      <p className="body" style={{ margin: 0 }}>
                        付款编号：<strong className="mono">{order.ref}</strong>
                      </p>
                      {!onSale ? (
                        <p className="body" style={{ margin: 0 }}>这一期已经结束，下一期日期待定，先不用付。</p>
                      ) : stripeEnabled() ? (
                        <form method="post" action="/api/pay/checkout">
                          <input type="hidden" name="ref" value={order.ref} />
                          <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                            刷卡付款（支持 Apple Pay / Google Pay）
                          </button>
                        </form>
                      ) : (
                        <p className="body" style={{ margin: 0 }}>现在没法刷卡，请私信 James，带上付款编号。</p>
                      )}
                    </div>
                    {perks}
                  </>
                )}
              </>
            ) : (
              <>
                {/* Phone first (2026-11-02): offer, then the form, then what the
                    room looks like and what people said — the proof is there
                    for whoever scrolls, the form never waits behind it. */}
                <div className="stack-3">
                  <span className="eyebrow">§ {MEMBERSHIP.title}</span>
                  <h1>4 个周二，看 James 用 AI 做出一个产品。</h1>
                  <p className="body-lg" style={{ margin: 0 }}>{MEMBERSHIP.priceLabel} 一期 {MEMBERSHIP.weeks} 周，刷卡一次付清，之后不会再扣款。</p>
                  <p className="body" style={{ margin: 0 }}>
                    {onSale
                      ? `第 ${onSale.number} 期：${cohortDatesLabel(onSale)}（都是周二）。这一期结束前办的，都算这一期。`
                      : "下一期日期待定。定了会写在这里，也会在群里说。"}
                  </p>
                </div>
                {!alreadyMember && onSale && (
                  <a className="btn btn--primary btn--block" href="#join-form" style={{ fontSize: "1.15rem" }}>加入 · {MEMBERSHIP.priceLabel} / {MEMBERSHIP.weeks} 周</a>
                )}
                <SceneImage id="scene-2" alt="Vibe Thursday 现场：有人站着分享，大家围着长桌听（现场照片转绘，人物已替换）" eager />
                {perks}
                {error && <p className="alert" role="alert">{error}</p>}
                {alreadyMember ? (
                  <p className="body-lg">✓ {knownName}，你已经是共创会员了，不用再买。</p>
                ) : !onSale ? null : (
                  <form method="post" action="/api/join" className="stack-6" id="join-form">
                    {knownName ? (
                      <div className="stack-2">
                        <input type="hidden" name="self" value="1" />
                        <p className="body-lg" style={{ margin: 0 }}>
                          ✓ 已认出你：<strong>{knownName}</strong>，名字和微信号不用再填。
                        </p>
                        <a className="body" href="/join?other=1">不是我？帮别人买点这里</a>
                      </div>
                    ) : (
                      <>
                        {loginHref && (
                          <div className="stack-3">
                            <a className="btn btn--wechat btn--block" href={loginHref}>
                              <WeChatMark />
                              报过名？用微信登录，不用再填
                            </a>
                            <p className="or-divider" style={{ margin: 0 }}>或者直接填写</p>
                          </div>
                        )}
                        <div>
                          <label className="label" htmlFor="join-name">名字</label>
                          <input className="field" id="join-name" name="name" required autoComplete="name" maxLength={60} />
                        </div>
                        <div>
                          <label className="label" htmlFor="join-wechat">微信号</label>
                          <input className="field" id="join-wechat" name="wechat" required autoCapitalize="off" autoCorrect="off" maxLength={60} />
                          <p className="hint">要和报名时填的一样，网站才认得你是会员。微信号在：微信 → 我 → 头像右边「微信号：」后面那串。</p>
                        </div>
                      </>
                    )}
                    <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                      去付款 {MEMBERSHIP.payLabel}
                    </button>
                  </form>
                )}
                {/* Open trial (2026-11-06): one Tuesday free to anyone, while it is upcoming. */}
                {trialDate && (
                  <p className="body" style={{ margin: 0 }}>
                    <strong>{formatSession(trialDate, "zh")}开放试听，不是会员也能先来看一次。</strong>{" "}
                    <a href="/tuesday#signup">去报名这一天 →</a>
                  </p>
                )}
                <p className="body-sm" style={{ color: "var(--fg3)", margin: 0 }}>
                  之前买过 599 的（10 月 25 日那门课，或 11 月 5 日前办的一年会员），会员照常有效，不用再买。
                </p>

                <section className="stack-4" aria-labelledby="join-proof">
                  <h2 className="h3" id="join-proof">每周都在的线下圈子</h2>
                  {TESTIMONIALS.map((item) => (
                    <blockquote className="quote" key={item.who}>
                      <p>{item.text}</p>
                      <cite>— {item.who}</cite>
                    </blockquote>
                  ))}
                  <div className="scene-strip" role="region" aria-label="往期现场" tabIndex={0}>
                    {SCENES.filter((scene) => scene.id !== "scene-2").map((scene) => (
                      <figure key={scene.id}>
                        <SceneImage id={scene.id} alt="" sizes="(min-width: 720px) 330px, 85vw" />
                        <figcaption className="hint">{scene.zh}</figcaption>
                      </figure>
                    ))}
                  </div>
                  <p className="hint" style={{ margin: 0 }}>画面由现场照片转绘，人物的脸都换掉了。</p>
                </section>
                {!alreadyMember && onSale && <StickyCta href="#join-form" label={`共创会员 · ${MEMBERSHIP.priceLabel} / ${MEMBERSHIP.weeks} 周`} cta="加入" />}
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
