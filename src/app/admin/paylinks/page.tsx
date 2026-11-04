import type { Metadata } from "next";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "直接付款链接 · 后台", robots: { index: false, follow: false } };

/**
 * Sign-up links with a QR code each, for people who sign up through the
 * organiser: send the link or show the code; the site's own forms register
 * the person themselves.
 *
 * Until 2026-11-05 this page also handed out two Stripe Payment Links (a
 * Tuesday ticket and a yearly membership). Both were removed when Tuesdays
 * went online with no single ticket and the membership became one 4-week
 * payment (review 2026-11-05). The /join form is the only way to sell it now.
 */
export default async function PayLinksPage() {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <p className="body">没有权限。先打开一次后台链接。</p>
      </main>
    );
  }

  // The site's own quick forms (2026-11-02): a nickname and a WeChat ID, then
  // pay. These register the person themselves; nothing to do by hand after.
  const origin = siteUrl();
  const forms = [
    { id: "quick-tue", title: "周二快速报名（线上，只对共创会员和导师团；不收费）", url: `${origin}/quick?d=tue` },
    { id: "quick-thu", title: "周四快速报名（填名字、微信号 → 报上，免费）", url: `${origin}/quick?d=thu` },
    { id: "join", title: "共创会员（填名字、微信号 → 直接刷卡）", url: `${origin}/join#join-form` },
  ];
  const formCodes = await Promise.all(forms.map((form) => QRCode.toDataURL(form.url, { width: 480, margin: 1 })));


  return (
    <main className="shell section stack-8" style={{ maxWidth: "720px" }}>
      <div className="stack-3">
        <h1 className="h2" style={{ margin: 0 }}>直接付款链接</h1>
        <p className="body">
          给想通过你直接报名的人：发链接，或者让他扫码。他自己填完就登记好了，不用你再处理。
        </p>
      </div>

      <h2 className="h3" style={{ margin: 0 }}>网站上的快速报名</h2>
      <p className="body-sm" style={{ margin: 0 }}>对方只填名字和微信号，付完自动登记，你不用再手动处理。</p>
      {forms.map((form, index) => (
        <section className="card stack-3" key={form.id} id={form.id} style={{ padding: "var(--space-6)" }}>
          <h3 className="h3" style={{ margin: 0 }}>{form.title}</h3>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made on the server */}
          <img src={formCodes[index]} alt={`${form.title}的二维码`} width={240} height={240} style={{ background: "#fff", borderRadius: "8px" }} />
          <p className="body-sm mono" style={{ overflowWrap: "anywhere", margin: 0 }}>{form.url}</p>
          <CopyLinkButton url={form.url} label="复制链接" copiedLabel="已复制" failedLabel="复制失败，长按上面的链接复制" />
        </section>
      ))}

    </main>
  );
}
