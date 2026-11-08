import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { capFor } from "@/lib/capacity";
import { listDeskRows, listPhotosForReview } from "@/lib/db";
import { buildDesk, deskStats } from "@/lib/desk";
import { can } from "@/lib/permissions";
import { deskFocus, feeFor, formatSession, isSpecialSession } from "@/lib/sessions";
import { staffRole } from "@/lib/staff";
import { QUESTIONS_ON_GO } from "@/lib/session-questions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "今天 · VT 后台", robots: { index: false, follow: false } };

/**
 * "Today" (2026-11-02): the first page for everyone on the team.
 *
 * It works out which session is in focus (Tuesday or Thursday), shows the
 * four numbers that matter on the morning, and the few buttons the morning
 * runs on — each only if this person may use it. No money amounts: the
 * unpaid line is a count of people, the same thing the desk shows.
 */
export default async function TodayPage() {
  const role = await staffRole();
  if (!can(role, "desk")) return <NoAccess />;

  const session = deskFocus();
  const tuesday = isSpecialSession(session);
  const charged = feeFor(session) !== null;

  const [rows, photos] = await Promise.all([
    listDeskRows(session).catch(() => []),
    can(role, "photos") ? listPhotosForReview().catch(() => []) : Promise.resolve([]),
  ]);
  const stats = deskStats(buildDesk(rows, charged));
  const pendingPhotos = photos.filter((photo) => photo.status === "pending").length;

  const numbers = [
    { label: "已报名", value: `${stats.booked}`, note: `上限 ${capFor(session)}` },
    { label: "已签到", value: `${stats.arrived}`, note: `还没到 ${stats.notYet}` },
    { label: "候补", value: `${stats.waitlisted}`, note: stats.waitlisted > 0 ? "有空位可以放人" : "" },
    ...(charged ? [{ label: "未付", value: `${stats.owing}`, note: stats.owing > 0 ? "签到台上找" : "" }] : []),
  ];

  type Action = { href: string; label: string; primary?: boolean; show: boolean; badge?: number };
  const actions: Action[] = [
    { href: `/admin/desk?s=${session}`, label: "打开签到台", primary: true, show: can(role, "desk") },
    { href: `/admin/door?s=${session}`, label: "门口签到码（全屏）", show: can(role, "desk") },
    { href: "/admin/waitlist", label: "候补", show: can(role, "waitlist"), badge: stats.waitlisted },
    { href: "/admin/questions", label: "本周问答", show: can(role, "questions") && !tuesday && QUESTIONS_ON_GO },
    { href: "/admin/photos", label: "照片审核", show: can(role, "photos"), badge: pendingPhotos },
    { href: "/admin", label: "管理员总览", show: can(role, "admin") },
  ];

  return (
    <main className="shell section stack-6">
      <div className="stack-2">
        <span className="eyebrow">{tuesday ? "Build Tuesday · 周二" : "Vibe Thursday · 周四"}</span>
        <h1 className="h2" style={{ margin: 0 }}>{formatSession(session, "zh")}</h1>
      </div>

      <section className="today-numbers" aria-label="这一场的数字">
        {numbers.map((item) => (
          <div className="today-number" key={item.label}>
            <span className="today-number__label">{item.label}</span>
            <strong className="today-number__value">{item.value}</strong>
            {item.note && <span className="today-number__note">{item.note}</span>}
          </div>
        ))}
      </section>

      <nav className="today-actions" aria-label="常用操作">
        {actions
          .filter((action) => action.show)
          .map((action) => (
            <a key={action.href} className={`btn ${action.primary ? "btn--primary" : "btn--secondary"} today-action`} href={action.href}>
              {action.label}
              {action.badge ? <span className="today-action__badge">{action.badge}</span> : null}
            </a>
          ))}
      </nav>
    </main>
  );
}
