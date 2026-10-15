import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy } from "@/lib/content";
import { getDinnerByRef } from "@/lib/db";
import { dinnerConfig, looksLikeDinnerRef } from "@/lib/dinner";
import { formatSession } from "@/lib/sessions";
import { tuesdayPaymentInfo } from "@/lib/tuesday-fee";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "聚餐付款 · Vibe Thursday", robots: { index: false } };

type PageProps = { searchParams: Promise<{ ref?: string }> };

/**
 * How to pay for a dinner seat (2026-10-15): amount, reference, bank details
 * (the same account as Tuesday's fee), "I've transferred". Chinese only.
 */
export default async function DinnerPayPage({ searchParams }: PageProps) {
  const { ref: raw } = await searchParams;
  const c = getCopy("zh");
  const ref = looksLikeDinnerRef(raw) ? raw : null;
  const seat = ref ? await getDinnerByRef(ref).catch(() => null) : null;
  const config = dinnerConfig();
  const dish = config?.dishes.find((d) => d.id === seat?.dish)?.zh ?? seat?.dish;
  const paymentInfo = tuesdayPaymentInfo();

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path="/" />
      <main id="main">
        <section className="section">
          <div className="shell stack-6" style={{ maxWidth: "680px", fontSize: "1.1rem" }}>
            {!seat || !config ? (
              <div className="stack-3">
                <h1>找不到这个聚餐座位</h1>
                <p className="body-lg">编号不对，或者这一场没有安排聚餐。有问题直接私信 James（<Link href="/#contact">微信二维码</Link>）。</p>
              </div>
            ) : (
              <>
                <div className="stack-3">
                  <span className="eyebrow">§ 散场聚餐 · {formatSession(seat.session, "zh")}</span>
                  <h1>
                    {seat.status === "cancelled" ? "这个座位已取消" : seat.status === "waitlist" ? "席位已满，你在候补名单上" : seat.status === "paid" ? `${seat.name}，饭桌上见！` : seat.claimed_at ? `${seat.name}，收到了` : "最后一步：转账占座"}
                  </h1>
                </div>

                {seat.status === "cancelled" ? (
                  <p className="body-lg">这个座位已经取消了，不用转账。</p>
                ) : seat.status === "waitlist" ? (
                  <p className="body-lg">有人让出座位时，我们会按顺序微信通知你，先不用转账。</p>
                ) : seat.status === "paid" ? (
                  <p className="body-lg">已经收到了。你点的是：{dish}。</p>
                ) : seat.claimed_at ? (
                  <p className="body-lg">转账通知收到了，核对到账后这里会变成「饭桌上见」。你点的是：{dish}。</p>
                ) : (
                  <>
                    <div className="card card--accent stack-3">
                      <p className="body-lg" style={{ margin: 0 }}>转账金额：<strong>{config.price} 澳元（含 GST）</strong> · 菜式：{dish}</p>
                      <p className="body-lg" style={{ margin: 0 }}>
                        转账备注填：<strong className="mono" style={{ fontSize: "1.4rem" }}>{seat.ref}</strong>
                      </p>
                      {paymentInfo ? (
                        <pre className="body" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{paymentInfo}</pre>
                      ) : (
                        <p className="body" style={{ margin: 0 }}>转账信息请私信 James 获取（<Link href="/#contact">微信二维码</Link>）。</p>
                      )}
                    </div>
                    <form method="post" action="/api/dinner/claim">
                      <input type="hidden" name="ref" value={seat.ref} />
                      <button className="btn btn--primary btn--block" type="submit" style={{ fontSize: "1.15rem" }}>我已经转账了</button>
                    </form>
                    <p className="body">付了才算占座。不退款，来不了可以把座位转给别人，私信 James 改名字就行。</p>
                  </>
                )}

                <p className="body">
                  地点：{config.place}
                  <br />
                  时间：{formatSession(seat.session, "zh")}，{config.time}
                  <br />
                  流程：每人 1 分钟自我介绍，再每人问一个问题，然后自由聊。
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
