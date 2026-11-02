import type { Metadata } from "next";
import { Avatar } from "@/components/Avatar";
import { cocreatorLabel, roleLabel } from "@/components/MemberCard";
import { buildWall } from "@/lib/checkin";
import { listCheckins, listWallMembers } from "@/lib/db";
import { deskSession, formatSession, isSpecialSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "今日在场 · Vibe Thursday", robots: { index: false, follow: false } };

/** Seconds between refreshes: a new check-in shows up within this. */
const REFRESH_SECONDS = 20;

/**
 * "今日在场" for the room's screen (2026-11-02): one
 * card per person who checked in and chose to be on the wall — the same
 * people, and no more, than the session's own public page names. A card
 * appears as each person checks in; the page reloads itself, no script.
 *
 * Public like that page, but kept out of search (robots.ts): it changes by
 * the minute and means nothing a day later.
 */
export default async function LivePage() {
  const session = deskSession();
  const [checkins, wall] = await Promise.all([listCheckins(session), listWallMembers()]);
  const attendees = buildWall(
    checkins.map((row) => ({ signup_id: row.signup_id, name: row.name, building: row.building, on_wall: row.on_wall, member: row.member })),
  );
  const bySlug = new Map(wall.map((member) => [member.slug, member]));
  // Newest first: the person who just checked in is at the top.
  const entries = [...attendees.entries].reverse();

  return (
    <main className="live">
      <meta httpEquiv="refresh" content={String(REFRESH_SECONDS)} />
      <header className="live__head">
        <h1 className="live__title">今日在场 · {formatSession(session, "zh")}{isSpecialSession(session) ? " · Build Tuesday" : ""}</h1>
        <p className="live__count">
          已签到 <strong>{attendees.total}</strong> 人
          {attendees.unnamed > 0 ? ` · 其中 ${attendees.unnamed} 位只签到不上墙` : ""}
        </p>
      </header>
      {entries.length === 0 ? (
        <p className="live__empty">扫门口的码签到，选「出现在今天的到场墙上」，你的名字就会出现在这里。</p>
      ) : (
        <ul className="live__grid">
          {entries.map((entry) => {
            const card = entry.kind === "card" ? bySlug.get(entry.slug) : undefined;
            const line = card?.headline ?? entry.building ?? card?.bio ?? null;
            return (
              <li className="live__card" key={entry.signup_id}>
                {card ? (
                  <Avatar id={card.id} name={card.display_name} hasAvatar={card.has_avatar} version={card.avatar_version} size="lg" />
                ) : (
                  <span className="monogram monogram--lg" aria-hidden="true">{[...entry.name][0] ?? "?"}</span>
                )}
                <div className="live__who">
                  <strong className="live__name">{card?.display_name ?? entry.name}</strong>
                  <span className="live__badges">
                    {card?.cocreator && <span className="chip chip--stage">{cocreatorLabel("zh")}</span>}
                    {card?.mentor && <span className="chip chip--stage">{roleLabel("mentor", "zh")}</span>}
                    {card?.builder && <span className="chip chip--stage">{roleLabel("builder", "zh")}</span>}
                  </span>
                  {line && <span className="live__line">{line}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
