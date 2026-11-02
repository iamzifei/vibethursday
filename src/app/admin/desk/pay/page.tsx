import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { getOrCreateSessionFee, listDeskRows } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";
import { feeFor, formatSession } from "@/lib/sessions";
import { newFeeRef, payLabel } from "@/lib/tuesday-fee";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "付款码 · 签到台", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<{ s?: string; id?: string }> };

/**
 * One person's Tuesday payment code, full screen, for them to scan at the
 * door (2026-11-02, the check-in desk). It opens the same /tuesday/pay page
 * their signup confirmation links to, by their own reference — card payment
 * settles it there and the desk shows "已付" on the next refresh.
 *
 * The reference is made here if they never opened the payment page: the same
 * get-or-create the signup uses, without a hold, so no place can lapse.
 */
export default async function DeskPayPage({ searchParams }: PageProps) {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <p className="body">没有权限。先打开一次后台链接。</p>
      </main>
    );
  }

  const { s, id } = await searchParams;
  const fee = s && isSessionDate(s) ? feeFor(s) : null;
  const person = fee !== null && id && /^\d{1,18}$/.test(id) ? (await listDeskRows(s!)).find((row) => row.id === id) : undefined;

  if (!person || fee === null) {
    return (
      <main className="shell section stack-4">
        <p className="body">找不到这个人，或者这一场不收费。</p>
        <Link href={s ? `/admin/desk?s=${s}` : "/admin/desk"}>← 回签到台</Link>
      </main>
    );
  }

  const back = `/admin/desk?s=${s}#r-${id}`;
  if (person.member) {
    return (
      <main className="shell section stack-4">
        <p className="body-lg">{person.name} 是共创会员，这一场免费，不用付。</p>
        <Link href={back}>← 回签到台</Link>
      </main>
    );
  }

  const { ref, status } = await getOrCreateSessionFee(s!, id!, newFeeRef());
  const url = `${await requestOrigin()}/tuesday/pay?ref=${ref}`;
  // Dark on white, never inverted: plenty of scanners fail on a light-on-dark code.
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a0b0d", light: "#ffffff" } });

  return (
    <main className="shell section stack-6" style={{ textAlign: "center", maxWidth: "520px" }}>
      <p style={{ margin: 0 }}><Link href={back}>← 回签到台</Link></p>
      <h1 className="h2" style={{ margin: 0 }}>{person.name} · 门票 {payLabel(fee)}</h1>
      <p className="body" style={{ margin: 0 }}>{formatSession(s!, "zh")} · Build Tuesday · 付款编号 <strong className="mono">{ref}</strong></p>
      {status === "paid" || status === "waived" ? (
        <p className="body-lg">这一场已经{status === "paid" ? "付过了" : "免收"}，不用再付。</p>
      ) : (
        <>
          {/* Built by this app from a URL this app composed; nothing from the request. */}
          <div className="door-qr" aria-label="付款二维码" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="body">请用手机相机或微信扫码，刷卡付款（支持 Apple Pay / Google Pay）。付完回签到台刷新，会变成「已付」。</p>
        </>
      )}
    </main>
  );
}
