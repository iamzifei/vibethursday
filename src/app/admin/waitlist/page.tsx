import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { capFor } from "@/lib/capacity";
import { listSignups } from "@/lib/db";
import { can } from "@/lib/permissions";
import { deskFocus, formatSession } from "@/lib/sessions";
import { staffRole } from "@/lib/staff";
import { waitlistFor } from "@/lib/waitlist-order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "候补 · VT 后台", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<{ msg?: string }> };

/**
 * The waitlist for the session in focus (2026-11-02, moved out of /admin so
 * an assistant can use it). One card per person, phone first; "give a place"
 * is one tap while a place is free. Going over the cap is the admin's call
 * alone (the API checks it too).
 */
export default async function WaitlistPage({ searchParams }: PageProps) {
  const role = await staffRole();
  if (!can(role, "waitlist")) return <NoAccess />;

  const { msg } = await searchParams;
  const session = deskFocus();
  const signups = await listSignups();
  const waiting = waitlistFor(signups, session);
  const booked = signups.filter((row) => row.sessions.includes(session)).length;
  const free = capFor(session) - booked;

  const when = (iso: string | undefined, fallback: string) =>
    iso
      ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Australia/Sydney", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
      : fallback;

  return (
    <main className="shell section stack-6">
      <div className="stack-2">
        <h1 className="h2" style={{ margin: 0 }}>候补</h1>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
          {formatSession(session, "zh")} · 已报 {booked} / {capFor(session)} · 候补 {waiting.length} 人，按进候补的先后排
        </p>
      </div>

      {msg && <p className="alert" role="status" style={{ overflowWrap: "anywhere" }}>{msg.slice(0, 300)}</p>}

      {waiting.length > 0 && free > 0 && (
        <p className="alert" role="status">
          现在空出 {free} 个位子。点「给 TA 位子」放人，再在微信里告诉对方。
        </p>
      )}

      {waiting.length === 0 ? (
        <p className="body" style={{ color: "var(--fg3)" }}>没有人在候补。</p>
      ) : (
        <ol className="desk-list">
          {waiting.map((row, index) => (
            <li className="desk-row" key={row.id}>
              <div className="desk-row__who">
                <strong className="desk-row__name">{index + 1}. {row.name}</strong>
                <span className="mono desk-row__wechat">{row.wechat ?? "没填微信号"}</span>
                {row.building && <span className="body-sm desk-row__topic">{row.building}</span>}
                <span className="body-sm" style={{ color: "var(--fg3)" }}>进候补：{when(row.waitlist_since[session], row.created_at)}</span>
              </div>
              <div className="desk-row__actions">
                {free > 0 || role === "admin" ? (
                  <form method="post" action="/api/admin/waitlist">
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="session" value={session} />
                    <button className={`btn btn--sm ${free > 0 ? "btn--primary" : "btn--secondary"}`} type="submit">
                      {free > 0 ? "给 TA 位子" : "超员放人"}
                    </button>
                  </form>
                ) : (
                  <span className="body-sm" style={{ color: "var(--fg3)" }}>满了，超员找管理员</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
