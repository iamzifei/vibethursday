import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { listMemberships, type MembershipRow } from "@/lib/db";
import { membershipSource, SOURCE_LABEL } from "@/lib/membership-admin";
import { sydneyToday } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "共创会员 · 后台", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<{ err?: string; ok?: string; q?: string }> };

const ERRORS: Record<string, string> = {
  name: "名字要填，最多 60 字。",
  wechat: "微信号要填，要和他报名时填的一样，周二才会自动免费。",
  date: "付款日期不对：不能是未来，也不能早于一年前（那样会员已经过期了）。",
  note: "备注要写怎么付的（比如「10-20 转账给主办人」），最多 200 字。",
};

/**
 * Every paid 共创会员 in one register (2026-11-02, membership-admin.ts): who,
 * how they paid, from when to when — and a form for someone who paid outside
 * the site, so the site stops charging them for Tuesdays.
 */
export default async function MembersAdminPage({ searchParams }: PageProps) {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <p className="body">没有权限。先打开一次后台链接。</p>
      </main>
    );
  }

  const params = await searchParams;
  const today = sydneyToday().toISOString().slice(0, 10);
  const all = await listMemberships();
  const needle = (params.q ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const rows = needle
    ? all.filter((row) => `${row.name}${row.wechat}${row.ref}`.toLowerCase().replace(/\s+/g, "").includes(needle))
    : all;
  const active = rows.filter((row) => row.active);
  const lapsed = rows.filter((row) => !row.active);
  const count = (source: string) => all.filter((row) => row.active && membershipSource(row) === source).length;

  return (
    <main className="shell section stack-6">
      <div className="stack-2">
        <h1 className="h2" style={{ margin: 0 }}>共创会员 · 在期 {all.filter((row) => row.active).length} 人</h1>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
          刷卡 {count("card")} · 10-25 课程转账 {count("class")} · 手动登记 {count("manual")}。
          报周二时按<strong>微信号</strong>认人，认出来就自动免收。
        </p>
      </div>

      {params.err && ERRORS[params.err] && <p className="alert" role="alert">{ERRORS[params.err]}</p>}
      {params.ok === "added" && <p className="alert" role="status">已登记。他下次报周二会自动免收；已经报了的，到付款页刷新一下就变免收。</p>}
      {params.ok === "already" && <p className="alert" role="status">这个微信号已经是在期会员，没有重复登记。</p>}

      <details className="card stack-3" open={Boolean(params.err)}>
        <summary><strong>手动登记一位会员</strong>（在网站以外付过 599 的人）</summary>
        <form method="post" action="/api/admin/membership" className="stack-3" style={{ marginTop: "var(--space-3)" }}>
          <label className="label">名字 <input className="field" name="name" required maxLength={60} /></label>
          <label className="label">微信号（和他报名时填的一样） <input className="field" name="wechat" required maxLength={60} autoCapitalize="off" autoCorrect="off" /></label>
          <label className="label">付款日期（会员从这天起算一年） <input className="field" type="date" name="date" defaultValue={today} max={today} required /></label>
          <label className="label">怎么付的 <input className="field" name="note" required maxLength={200} placeholder="比如：10-20 转账给主办人，截图在微信" /></label>
          <button className="btn btn--primary" type="submit">登记</button>
        </form>
      </details>

      <form className="wall-search" action="/admin/members">
        <input className="field" type="search" name="q" defaultValue={params.q ?? ""} placeholder="搜名字、微信号、编号" />
        <button className="btn btn--secondary" type="submit">搜</button>
      </form>

      <section className="stack-3">
        <h2 className="h3" style={{ margin: 0 }}>在期 · {active.length}</h2>
        {active.length ? <MembershipList list={active} /> : <p className="body-sm" style={{ color: "var(--fg3)" }}>没有。</p>}
      </section>
      {lapsed.length > 0 && (
        <details className="stack-3">
          <summary><strong>已过期 · {lapsed.length}</strong></summary>
          <MembershipList list={lapsed} />
        </details>
      )}
    </main>
  );
}

/** One row per paid membership: who, how they paid, from when to when. */
function MembershipList({ list }: { list: MembershipRow[] }) {
  return (
    <ul className="desk-list">
      {list.map((row) => (
        <li className="desk-row" key={row.id}>
          <div className="desk-row__who">
            <strong className="desk-row__name">{row.name}</strong>
            <span className="mono desk-row__wechat">{row.wechat} · {row.ref}</span>
            <span className="desk-row__tags">
              <span className="pill">{SOURCE_LABEL[membershipSource(row)]}</span>
              <span className={row.active ? "pill pill--live" : "pill"}>{row.paid_on} → {row.expires_on}</span>
            </span>
            {row.note && <span className="body-sm desk-row__topic">{row.note}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
