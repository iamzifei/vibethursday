import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy } from "@/lib/content";
import { getSessionFeeByRef } from "@/lib/db";
import { feeFor, formatSession } from "@/lib/sessions";
import { feeLabel, looksLikeFeeRef, payLabel, tuesdayPaymentInfo } from "@/lib/tuesday-fee";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "周二付款 · Vibe Thursday", robots: { index: false } };

type PageProps = { searchParams: Promise<{ ref?: string; done?: string }> };

/**
 * How to pay for a Build Tuesday (2026-10-14). Reached from the signup
 * confirmation and from /my, by a payment reference. The same shape as the
 * class's payment view: amount, reference, bank details, "I've transferred".
 * Chinese only, like /class: the people paying are in the Chinese group.
 */
export default async function TuesdayPayPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const c = getCopy("zh");
  const ref = looksLikeFeeRef(params.ref) ? params.ref : null;
  const fee = ref ? await getSessionFeeByRef(ref).catch(() => null) : null;
  const price = fee ? feeFor(fee.session) : null;
  const paymentInfo = tuesdayPaymentInfo();

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path="/tuesday" />
      <main id="main">
        <section className="section">
          <div className="shell stack-6" style={{ maxWidth: "680px", fontSize: "1.1rem" }}>
            {!fee || price === null ? (
              <div className="stack-3">
                <h1>找不到这条付款</h1>
                <p className="body-lg">
                  编号不对，或者链接不完整。可以在 <a href="/my">查我的报名</a> 里重新打开付款页。
                </p>
              </div>
            ) : (
              <>
                <div className="stack-3">
                  <span className="eyebrow">§ Build Tuesday · {formatSession(fee.session, "zh")}</span>
                  <h1>
                    {!fee.booked && fee.status !== "paid"
                      ? "这一场不用付了"
                      : fee.status === "paid" || fee.status === "waived"
                      ? `${fee.name}，周二见！`
                      : fee.claimed_at
                        ? `${fee.name}，收到了`
                        : "报上了，最后一步：转账"}
                  </h1>
                </div>

                {!fee.booked && fee.status !== "paid" ? (
                  <p className="body-lg">这一场的报名已经取消或改了，不用转账。想再报，去 <Link href="/tuesday">周二报名页</Link>。</p>
                ) : fee.status === "paid" || fee.status === "waived" ? (
                  <p className="body-lg">已经收到了，不用再转。到了在门口扫码签到就行。</p>
                ) : fee.claimed_at ? (
                  <div className="stack-3">
                    <div className="tick" aria-hidden="true">✓</div>
                    <p className="body-lg" style={{ margin: 0 }}>转账通知收到了。核对到账后这里会变成「已付」，周二直接来。</p>
                    <details>
                      <summary className="body-sm">再看一下转账信息</summary>
                      <div className="stack-2" style={{ marginTop: "var(--space-3)" }}>
                        <p style={{ margin: 0 }}>
                          转账金额：{payLabel(price)} · 转账备注：<strong className="mono">{fee.ref}</strong>
                        </p>
                        {paymentInfo && <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>}
                      </div>
                    </details>
                  </div>
                ) : (
                  <>
                    <div className="card card--accent stack-3">
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账金额：<strong>{payLabel(price)}</strong>
                        <span className="hint"> · 标价 {feeLabel(price)}</span>
                      </p>
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账备注填：<strong className="mono" style={{ fontSize: "1.4rem" }}>{fee.ref}</strong>
                      </p>
                      {paymentInfo ? (
                        <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>
                      ) : (
                        <p className="body" style={{ margin: 0 }}>
                          转账信息请私信 James 获取（<Link href="/#contact">微信二维码</Link>）。
                        </p>
                      )}
                    </div>
                    <form method="post" action="/api/tuesday/claim">
                      <input type="hidden" name="ref" value={fee.ref} />
                      <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>
                        我已经转账了
                      </button>
                    </form>
                    <p className="body">
                      备注编号别填错，我们靠它对账。共创会员周二免费，<a href="/class">了解会员</a>。
                    </p>
                  </>
                )}

                <p className="body">
                  时间：{formatSession(fee.session, "zh")}上午 10:00–12:00
                  <br />
                  地点：Chatswood，具体地址报名后在群里发
                </p>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
