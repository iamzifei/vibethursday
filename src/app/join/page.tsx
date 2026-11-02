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
import { MEMBERSHIP, looksLikeMemberRef } from "@/lib/course";
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
    description: "Vibe Thursday 共创会员：599 澳元一年，每年自动续费。一年内每周二 Build Tuesday 免门票，再送一次澳洲 AI+IP 实战课。",
    ...(ref ? { robots: { index: false } } : {}),
  };
}

type PageProps = { searchParams: Promise<{ ref?: string; paid?: string; error?: string; err?: string; other?: string }> };

/** What the membership gives, shown before and after paying. */
const PERKS = [
  "一年内每周二 Build Tuesday 免门票（平时 30 澳元一次）",
  "送一次澳洲 AI+IP 实战课（365 澳元那门），报名时自动确认，不用付钱",
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
};

/**
 * The 共创会员 on its own (2026-11-02, course.ts MEMBERSHIP): what it gives,
 * name and WeChat ID, then straight to Stripe. Back from Stripe — or opened
 * later by its reference — the page settles the payment if the webhook has
 * not yet, and says whether it went through. Chinese only, like /class.
 */
export default async function JoinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const c = getCopy("zh");
  const ref = looksLikeMemberRef(params.ref) ? params.ref : null;
  let order = ref ? await getCourseOrderByRef(ref).catch(() => null) : null;
  if (order && order.course !== MEMBERSHIP.id) order = null;
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
                    <p className="body-lg">付款已确认，从今天起一年内有效，到期自动续费。</p>
                    {perks}
                    <p className="body">
                      付款编号 <strong className="mono">{order.ref}</strong>，有问题私信 James 时带上它。报周二时用同一个微信号，会自动免费。
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
                      {stripeEnabled() ? (
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
                  <h1>一年的 Build Tuesday，再加一次 AI+IP 课。</h1>
                  <p className="body-lg" style={{ margin: 0 }}>{MEMBERSHIP.priceLabel} 一年，刷卡付款，付完马上生效，每年自动续费。</p>
                </div>
                {!alreadyMember && (
                  <a className="btn btn--primary btn--block" href="#join-form" style={{ fontSize: "1.15rem" }}>加入 · {MEMBERSHIP.priceLabel} / 年</a>
                )}
                <SceneImage id="scene-2" alt="Vibe Thursday 现场：有人站着分享，大家围着长桌听（现场照片转绘，人物已替换）" eager />
                {perks}
                {error && <p className="alert" role="alert">{error}</p>}
                {alreadyMember ? (
                  <p className="body-lg">✓ {knownName}，你已经是共创会员了，不用再买。</p>
                ) : (
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
                          <p className="hint">要和报周二时填的一样，周二才会自动免费。微信号在：微信 → 我 → 头像右边「微信号：」后面那串。</p>
                        </div>
                      </>
                    )}
                    <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                      去付款 {MEMBERSHIP.payLabel}
                    </button>
                  </form>
                )}
                <p className="body-sm" style={{ color: "var(--fg3)", margin: 0 }}>
                  之前买过 599 的（10 月 25 日那门课），已经是共创会员，不用再买。不想续费了，私信 James 取消，当年的权益照常用到期满。
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
                {!alreadyMember && <StickyCta href="#join-form" label={`共创会员 · ${MEMBERSHIP.priceLabel} / 年`} cta="加入" />}
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
