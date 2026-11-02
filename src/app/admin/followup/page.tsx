import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { listDeskRows } from "@/lib/db";
import { buildDesk } from "@/lib/desk";
import { ACTION_LABEL, ACTION_ORDER, followUps } from "@/lib/followup";
import { deskSession, feeFor, formatSession, sessionForDay } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "会后跟进 · 后台", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<{ s?: string; day?: string }> };

/**
 * After a session (2026-11-02, followup.ts): the people who came, grouped by
 * what to do next, each with what they wrote when signing up. Organiser-only:
 * it carries WeChat IDs.
 */
export default async function FollowUpPage({ searchParams }: PageProps) {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <p className="body">没有权限。先打开一次后台链接。</p>
      </main>
    );
  }
  const { s, day } = await searchParams;
  const session = s && isSessionDate(s) ? s : (sessionForDay(day) ?? deskSession());
  const items = followUps(buildDesk(await listDeskRows(session), feeFor(session) !== null), session);

  return (
    <main className="shell section stack-6">
      <div className="stack-2">
        <h1 className="h2" style={{ margin: 0 }}>会后跟进 · {formatSession(session, "zh")}</h1>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
          只列签到了的人，按规则分组：带的需求、项目、证书备考、常来但还不是会员、第一次来。一个人可能在几组里。
          {" "}<Link href={`/admin/desk?s=${session}`}>回签到台</Link>
          {" · "}<a href={`/api/admin/export?what=followup&session=${session}`}>下载</a>
        </p>
      </div>
      {items.length === 0 && <p className="body" style={{ color: "var(--fg3)" }}>这一场还没有需要跟进的人（或者还没人签到）。</p>}
      {ACTION_ORDER.map((action) => {
        const group = items.filter((item) => item.actions.includes(action));
        if (group.length === 0) return null;
        return (
          <section className="stack-3" key={action}>
            <h2 className="h3" style={{ margin: 0 }}>{ACTION_LABEL[action].title} · {group.length}</h2>
            <p className="body-sm" style={{ margin: 0 }}>{ACTION_LABEL[action].todo}</p>
            <ul className="desk-list">
              {group.map(({ entry }) => (
                <li className="desk-row" key={entry.id}>
                  <div className="desk-row__who">
                    <strong className="desk-row__name">{entry.name}</strong>
                    <span className="mono desk-row__wechat">{entry.wechat ?? "没填微信号"}</span>
                    {entry.topic && <span className="body-sm desk-row__topic">想聊：{entry.topic}</span>}
                    {entry.building && <span className="body-sm desk-row__topic">在做：{entry.building}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
