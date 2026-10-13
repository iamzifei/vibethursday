import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { getCopy } from "@/lib/content";
import { listProfileTags, listTaggingRoster, listTaggingSessions } from "@/lib/db";
import { formatSession, sydneyToday } from "@/lib/sessions";
import { TagBoard } from "./TagBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "标注 · 后台", robots: { index: false } };

type PageProps = { searchParams: Promise<{ s?: string }> };

/**
 * After a morning: tag who came (2026-10-13). Organiser-only, like /admin;
 * see src/lib/person-profile.ts for what is noted and why it stays here.
 */
export default async function TagPage({ searchParams }: PageProps) {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <div className="card stack-3">
          <h1 className="h3">Not authorised</h1>
          <p className="body-sm">
            Open <code>/admin?key=YOUR_ADMIN_TOKEN</code> once on this device, then come back here.
          </p>
        </div>
      </main>
    );
  }

  const { s } = await searchParams;
  const today = sydneyToday().toISOString().slice(0, 10);
  const sessions = await listTaggingSessions(today);
  // The morning just gone, unless another one was picked.
  const session = s && isSessionDate(s) ? s : (sessions[0]?.session ?? today);

  const [people, suggestions] = await Promise.all([listTaggingRoster(session), listProfileTags()]);
  const fields = getCopy("zh").signup.fields;

  return (
    <main className="shell section stack-6 tagger">
      <div className="stack-3">
        <div className="tagger-top">
          <span className="eyebrow">后台 · 标注</span>
          <span className="tagger-top__links">
            <Link href="/admin/people">看所有人 →</Link>
            <Link href="/admin">回后台</Link>
          </span>
        </div>
        <h1 className="h2">{formatSession(session, "zh")} 来的人</h1>
        <nav className="filters" aria-label="选场次">
          {sessions.map((item) => (
            <Link
              key={item.session}
              className={item.session === session ? "chip chip--link chip--on" : "chip chip--link"}
              href={`/admin/tag?s=${item.session}`}
            >
              {item.session.slice(5)}
              {item.attended > 0 && (
                <span className="tagger-muted">
                  {" "}
                  {item.tagged}/{item.attended}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      <TagBoard
        // A new morning is a new board, not the old one's state carried over.
        key={session}
        session={session}
        people={people}
        suggestions={suggestions}
        labels={{
          industry: [...fields.industryOptions],
          purpose: [...fields.purposeOptions],
          aiLevel: [...fields.aiLevelOptions],
          bizFocus: [...fields.bizFocusOptions],
        }}
      />
    </main>
  );
}
