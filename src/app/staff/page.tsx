import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { staffRole } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "团队入口 · Vibe Thursday", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<{ bad?: string }> };

/**
 * The team's door (2026-11-02): one short address to remember,
 * vibethursday.com/staff.
 *
 * - Already on the team on this phone → straight into the back office.
 * - Otherwise → what to do: open, once, the personal link the organiser sent.
 *
 * Why a personal link and not the site's WeChat sign-in: that sign-in rests
 * on a name and a WeChat ID, which anyone at the table can see. The link is
 * made per person on /admin/roles and stops working when the role is removed.
 */
export default async function StaffPage({ searchParams }: PageProps) {
  const role = await staffRole();
  if (role === "admin") redirect("/admin");
  if (role === "assistant") redirect("/admin/desk");

  const { bad } = await searchParams;

  return (
    <main id="main" className="shell section" style={{ maxWidth: 480 }}>
      <div className="card stack-4">
        <span className="eyebrow">VT 团队</span>
        <h1 className="h2" style={{ margin: 0 }}>团队入口</h1>

        {bad && (
          <p className="alert" role="alert">
            这条链接用不了：可能已经过期，或者你的助理身份被换过。请主办人在后台重新发一条给你。
          </p>
        )}

        <p className="body" style={{ margin: 0 }}>
          第一次进：在微信里点开主办人私发给你的<strong>专属登录链接</strong>，点一次就行。
        </p>
        <p className="body" style={{ margin: 0 }}>
          以后：在同一台手机上打开 <span className="mono">vibethursday.com/staff</span>，直接进后台。
        </p>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
          换了手机或者清了浏览器，请主办人再发一次链接。这条链接只给你一个人用，别转发。
        </p>
      </div>
    </main>
  );
}
