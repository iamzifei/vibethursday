import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { langSuffix, MemberCard } from "@/components/MemberCard";
import { SessionRow } from "@/components/SessionRow";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { buildArchive } from "@/lib/archive";
import { buildWall, isSessionDate, type WallCheckin } from "@/lib/checkin";
import { getCopy, resolveLang } from "@/lib/content";
import { countCheckins, listCheckins, listWallMembers, listWharfQuestions } from "@/lib/db";
import { monogram } from "@/lib/members";
import { formatSession, nextThursdays, sydneyToday } from "@/lib/sessions";

type PageProps = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { date } = await params;
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const a = c.archive;

  if (!isSessionDate(date)) return { title: a.meta.title };

  const written = c.gallery.sessions.find((session) => session.date === date);
  const title = `${written?.title ?? formatSession(date, lang)} · Vibe Thursday`;

  return {
    title,
    description: a.detailDescription.replace("{title}", written?.title ?? formatSession(date, lang)),
  };
}

/**
 * One session's own page: the archive row for that morning, then who was
 * there according to the check-ins.
 *
 * The check-in page sends people here the moment they have tapped their
 * name, so on the day this is "who is in the room right now"; afterwards it
 * is the record. Same page, same rows — the only thing that changes is the
 * heading's tense.
 *
 * Two gates on the wall, both already enforced upstream: `on_wall` was the
 * person's own answer at check-in, and a card is used only if it is published
 * and not hidden — the same gate `/members` uses, applied here by `buildWall`.
 */
export default async function SessionPage({ params, searchParams }: PageProps) {
  const { date } = await params;
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const a = c.archive;

  if (!isSessionDate(date)) notFound();

  const [wall, questions, attendance, checkins] = await Promise.all([
    listWallMembers(),
    listWharfQuestions(),
    countCheckins(),
    listCheckins(date),
  ]);

  const row = buildArchive(c.gallery.sessions, wall, questions, attendance).find(
    (candidate) => candidate.date === date,
  );

  // Neither written up nor checked in to: not a session this site knows.
  if (!row) notFound();

  // Contact details stay in this function. `WallCheckin` is the shape the
  // wall needs and nothing more.
  const entries: WallCheckin[] = checkins.map((checkin) => ({
    signup_id: checkin.signup_id,
    name: checkin.name,
    building: checkin.building,
    on_wall: checkin.on_wall,
    member: checkin.member,
  }));
  const attendees = buildWall(entries);

  const bySlug = new Map(wall.map((member) => [member.slug, member]));
  const upcoming = nextThursdays(1)[0];
  const isToday = date === sydneyToday().toISOString().slice(0, 10);

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path={`/sessions/${date}`} />

      <main id="main">
        <section className="section">
          <div className="shell stack-8">
            <p>
              <Link href={`/sessions${langSuffix(lang)}`}>{a.backToArchive}</Link>
            </p>

            <ol className="archive">
              <SessionRow row={row} lang={lang} copy={a} eager />
            </ol>
          </div>
        </section>

        <section className="section" id="wall">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{a.eyebrow}</span>
              <h2>{isToday ? a.wallTitleToday : a.wallTitle}</h2>
              <p className="body-lg" style={{ maxWidth: "58ch" }}>
                {a.wallLede}
              </p>
            </div>

            {attendees.total === 0 ? (
              <p className="alert">{a.noCheckins}</p>
            ) : (
              <>
                <p className="mono" style={{ color: "var(--fg3)" }}>
                  {a.attended.replace("{n}", String(attendees.total))}
                </p>

                {attendees.entries.length > 0 && (
                  <div className="mwall">
                    {attendees.entries.map((entry) => {
                      if (entry.kind === "card") {
                        const member = bySlug.get(entry.slug);
                        // A card that left the wall between the check-in and
                        // this render: show the person as a light entry
                        // rather than nothing, since they said yes.
                        if (member) {
                          return (
                            <MemberCard
                              key={entry.slug}
                              member={member}
                              copy={c.members}
                              lang={lang}
                              upcoming={upcoming}
                            />
                          );
                        }
                      }

                      const name = entry.kind === "card" ? entry.slug : entry.name;
                      const building = entry.kind === "light" ? entry.building : null;

                      return (
                        <article className="mcard mcard--light" key={`${entry.kind}-${name}`}>
                          <div className="mcard__head">
                            <span className="monogram" aria-hidden="true">
                              {monogram(name)}
                            </span>
                            <div className="mcard__id">
                              <h3 className="mcard__name">{name}</h3>
                              {building && <p className="mcard__headline">{building}</p>}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {attendees.unnamed > 0 && (
                  <p className="body-sm" style={{ color: "var(--fg3)" }}>
                    {a.unnamed.replace("{n}", String(attendees.unnamed))}
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
