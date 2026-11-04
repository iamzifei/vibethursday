import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { QuickBotCheck } from "@/components/QuickBotCheck";
import { getCopy } from "@/lib/content";
import { quickSession } from "@/lib/quick-signup";
import { bookableSessions, feeFor, formatSession, isOnlineSession, isSpecialSession } from "@/lib/sessions";
import { TUESDAY_ONLINE } from "@/lib/tuesday-venue";
import { feeLabel } from "@/lib/tuesday-fee";

type PageProps = {
  searchParams: Promise<{ d?: string; s?: string; done?: string; err?: string; h?: string }>;
};

export const dynamic = "force-dynamic";

// Handed out one person at a time: not a page for search results.
export const metadata: Metadata = { title: "快速报名 · Vibe Thursday", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  missing: "名字和微信号都要填，各 60 字以内。",
  closed: "这一天暂时没有能报的场次。",
  name: "这个微信号之前报过名，用的是别的名字。请填报名时用的那个名字；想不起来的话，在「我的」页查一下。",
  bot: "没确认上你不是机器人。等按钮变成可点再点；还不行就刷新一下页面。",
  rate: "这台手机或这个网络刚报过好几次了，过几分钟再试；急的话直接找主办人。",
  failed: "没报上，请再试一次；还不行就私信主办人。",
};

/**
 * /quick?d=tue|thu (2026-11-02, quick-signup.ts): a nickname and a WeChat ID,
 * then straight to payment for a Tuesday, or booked for a Thursday. The link
 * and its QR code live on /admin/paylinks for the organiser to hand out.
 */
export default async function QuickPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const c = getCopy("zh");
  const day = params.d === "thu" ? "thu" : "tue";
  const session = quickSession(day, bookableSessions(6), isSpecialSession);
  const fee = session ? feeFor(session) : null;
  const doneSession = params.s && /^\d{4}-\d{2}-\d{2}$/.test(params.s) ? params.s : null;

  const hint = params.h && /^[^<>]{1,8}$/.test(params.h) ? params.h : null;
  const doneText =
    params.done === "booked" ? `报上了：${formatSession(doneSession ?? "", "zh")} 的周四上午 10:30，Chatswood。到了扫桌上的码签到。`
    : params.done === "free" ? `报上了：${formatSession(doneSession ?? "", "zh")} 的周二，门票已经结清或不用付。地址在「我的」页里。`
    : params.done === "online" ? `报上了：${formatSession(doneSession ?? "", "zh")} 的线上周二，10:30–12:00。${TUESDAY_ONLINE.zh.howToJoin}`
    : params.done === "onlineJoin" ? `报上了：${formatSession(doneSession ?? "", "zh")} 的线上周二。${c.signup.onlineMembersOnly}`
    : params.done === "waitlist" ? `${formatSession(doneSession ?? "", "zh")} 已经满了，你在候补名单上。有人取消会通知你，收到通知再来。`
    : null;

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path={day === "tue" ? "/tuesday" : "/"} />
      <main id="main">
        <section className="section">
          <div className="shell stack-6" style={{ maxWidth: "520px" }}>
            <div className="stack-3">
              <span className="eyebrow">§ 快速报名</span>
              <h1 className="h2" style={{ margin: 0 }}>{day === "tue" ? "报名周二 Build Tuesday" : "报名周四 Vibe Thursday"}</h1>
              {session && (
                <p className="body-lg" style={{ margin: 0 }}>
                  {formatSession(session, "zh")} ·{" "}
                  {isOnlineSession(session)
                    ? "10:30–12:00 · 线上 · 共创会员参加"
                    : <>{day === "tue" ? "10:30–12:30" : "10:30 开始"} · Chatswood · {fee !== null ? `${feeLabel(fee)}，填完直接刷卡` : "免费"}</>}
                </p>
              )}
            </div>

            {doneText ? (
              <div className="stack-3">
                <p className="alert" role="status">{doneText}</p>
                <Link className="btn btn--secondary" href="/my">看我的报名 →</Link>
              </div>
            ) : session ? (
              <form method="post" action="/api/quick" className="stack-4">
                {params.err && ERRORS[params.err] && (
                  <p className="alert alert--error" role="alert">
                    {ERRORS[params.err]}
                    {params.err === "name" && hint && ` 你上次填的名字是「${hint}」这样开头结尾的。`}
                  </p>
                )}
                <input type="hidden" name="day" value={day} />
                <div>
                  <label className="label" htmlFor="quick-name">怎么称呼你</label>
                  <input className="field" id="quick-name" name="name" required maxLength={60} autoComplete="name" placeholder="名字或网名" />
                </div>
                <div>
                  <label className="label" htmlFor="quick-wechat">微信号</label>
                  <input className="field" id="quick-wechat" name="wechat" required maxLength={60} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="微信号，不是昵称" />
                  <p className="field-hint">签到时用它认出你。在 微信 → 我 → 头像右边「微信号：」后面那串。</p>
                </div>
                <QuickBotCheck siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} label={fee !== null ? "去付款" : "报名"} />
                {fee !== null && <p className="field-hint" style={{ margin: 0 }}>共创会员不用付，点了会直接报上。</p>}
              </form>
            ) : (
              <p className="body-lg">{ERRORS.closed}</p>
            )}

            <p className="body-sm" style={{ color: "var(--fg3)", margin: 0 }}>
              想多说几句自己在做什么，报完以后去 <Link href="/my">「我的」</Link> 补。
            </p>
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
