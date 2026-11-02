import type { Metadata } from "next";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { MEMBERSHIP } from "@/lib/course";
import { feeToPay } from "@/lib/tuesday-fee";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "直接付款链接 · 后台", robots: { index: false, follow: false } };

/**
 * Two fixed card-payment links, with a QR code each (2026-11-02): a Build
 * Tuesday ticket and the 共创会员. For people who sign up through the
 * organiser rather than through the site: send them the link or show the
 * code, they pay, and the organiser does the sign-up for them afterwards.
 *
 * The links are Stripe Payment Links set in the environment (PAYLINK_TUESDAY,
 * PAYLINK_MEMBER), not written here: this repository is public. A payment made
 * through them is not tied to anyone on the site — the webhook ignores it,
 * because it carries none of this site's references — so the organiser
 * registers the person by hand, which is what the steps under each code say.
 */
export default async function PayLinksPage() {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <p className="body">没有权限。先打开一次后台链接。</p>
      </main>
    );
  }

  const links = [
    {
      id: "tuesday",
      title: "Build Tuesday 门票",
      amount: `${feeToPay(30)} 澳元（含 GST）`,
      url: process.env.PAYLINK_TUESDAY?.trim() ?? "",
      env: "PAYLINK_TUESDAY",
      after: [
        "对方付款时会填名字、微信号和哪个周二。",
        "到 Stripe 后台的付款记录里看这三项。",
        "在「周二报名与收费」或周二签到台找到他（没报名就先帮他在 /tuesday 报上），点「标已付」。",
      ],
    },
    {
      id: "member",
      title: "共创会员 · 一年",
      amount: `${MEMBERSHIP.amount.toFixed(2)} 澳元（含 GST），每年自动续费`,
      url: process.env.PAYLINK_MEMBER?.trim() ?? "",
      env: "PAYLINK_MEMBER",
      after: [
        "对方付款时会填名字和微信号。",
        "到「共创会员」页手动登记，备注写「付款链接 + 日期」。微信号要和他报名时填的一样，周二才会自动免费。",
        "这条链接的续费，网站不会自动延长会员期，明年到期时要在「共创会员」页再登记一次。",
      ],
    },
  ];

  const codes = await Promise.all(
    links.map((link) => (link.url ? QRCode.toDataURL(link.url, { width: 480, margin: 1 }) : Promise.resolve(""))),
  );

  return (
    <main className="shell section stack-8" style={{ maxWidth: "720px" }}>
      <div className="stack-3">
        <h1 className="h2" style={{ margin: 0 }}>直接付款链接</h1>
        <p className="body">
          给想通过你直接报名的人：发链接，或者让他扫码。付完以后你帮他登记，下面每张卡写了怎么登记。
        </p>
      </div>

      {links.map((link, index) => (
        <section className="card stack-3" key={link.id} id={link.id} style={{ padding: "var(--space-6)" }}>
          <h2 className="h3" style={{ margin: 0 }}>{link.title}</h2>
          <p className="body" style={{ margin: 0 }}>{link.amount}</p>
          {link.url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made on the server */}
              <img src={codes[index]} alt={`${link.title}的付款二维码`} width={240} height={240} style={{ background: "#fff", borderRadius: "8px" }} />
              <p className="body-sm mono" style={{ overflowWrap: "anywhere", margin: 0 }}>{link.url}</p>
              <CopyLinkButton url={link.url} label="复制链接" copiedLabel="已复制" failedLabel="复制失败，长按上面的链接复制" />
              <ol className="body-sm stack-1" style={{ margin: 0 }}>
                {link.after.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </>
          ) : (
            <p className="alert" role="status">还没配置：服务器上缺环境变量 {link.env}。</p>
          )}
        </section>
      ))}
    </main>
  );
}
