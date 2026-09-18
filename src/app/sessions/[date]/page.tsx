import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { langSuffix, MemberCard } from "@/components/MemberCard";
import { SessionRow } from "@/components/SessionRow";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { buildArchive } from "@/lib/archive";
import { buildWall, isSessionDate, type WallCheckin } from "@/lib/checkin";
import { type Copy, getCopy, type Lang, resolveLang } from "@/lib/content";
import { JsonLd } from "@/components/JsonLd";
import { eventJsonLd, pageAlternates } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
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

  // A Thursday that has not happened yet describes itself as such.
  const description = nextThursdays(6).includes(date)
    ? a.upcomingDescription.replace("{date}", formatSession(date, lang))
    : a.detailDescription.replace("{title}", written?.title ?? formatSession(date, lang));

  return {
    alternates: pageAlternates(`/sessions/${date}`, lang),
    title,
    description,
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

  // Neither written up nor checked in to. If it is one of the next few
  // Thursdays, it is a session this site knows about and has simply not
  // happened yet — the third tense of this page. Anything else is not a
  // session this site knows.
  if (!row) {
    if (!nextThursdays(6).includes(date)) notFound();
    return <UpcomingSession date={date} lang={lang} copy={c} />;
  }

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

  // This morning as an Event, for crawlers: the write-up is its description
  // and the poster and photographs are its pictures. Only sessions that have
  // happened reach this page, so it is always a past event.
  const base = siteUrl();
  const pictures = [
    ...(row.poster ? [`${base}${row.poster}-1200.jpg`] : []),
    ...row.photos.map((photo) => `${base}${photo.src}-1600.jpg`),
  ];

  return (
    <div lang={c.htmlLang}>
      <JsonLd
        data={[
          eventJsonLd(date, lang, c, {
            page: true,
            title: row.title ?? undefined,
            description: row.note ?? undefined,
            images: pictures,
          }),
        ]}
      />
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

                      return (
                        <article className="mcard mcard--light" key={entry.signup_id}>
                          <div className="mcard__head">
                            <span className="monogram" aria-hidden="true">
                              {monogram(entry.name)}
                            </span>
                            <div className="mcard__id">
                              <h3 className="mcard__name">{entry.name}</h3>
                              {entry.building && <p className="mcard__headline">{entry.building}</p>}
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

/**
 * A session before it has happened.
 *
 * Until 2026-09-18 this address was a 404 before the day, so "this coming
 * Thursday" had no page of its own — and both search engines and answer
 * engines want exactly that: one event, one URL, with the date, the time and
 * the street address on it. Everything here is the home page's own facts and
 * run of show, restated for one date, with that date's Event as structured
 * data. The sign-up still lives on the home page; this only points at it.
 */
function UpcomingSession({ date, lang, copy: c }: { date: string; lang: Lang; copy: Copy }) {
  const a = c.archive;
  const when = formatSession(date, lang);

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={[eventJsonLd(date, lang, c, { page: true })]} />
      <SiteHeader lang={lang} copy={c} path={`/sessions/${date}`} />

      <main id="main">
        <section className="section">
          <div className="shell stack-8">
            <p>
              <Link href={`/sessions${langSuffix(lang)}`}>{a.backToArchive}</Link>
            </p>

            <div className="stack-4">
              <span className="eyebrow">{a.upcomingEyebrow}</span>
              <h1>{a.upcomingTitle.replace("{date}", when)}</h1>
              <p className="body-lg" style={{ maxWidth: "58ch" }}>
                {a.upcomingLede}
              </p>
            </div>

            {/* The same three cards as the home page's first screen, so the
                two can never disagree about when, where or how much. */}
            <dl className="grid-auto" style={{ margin: 0 }}>
              {c.hero.facts.map((fact) => (
                <div className="card stack-2" key={fact.label}>
                  <dt className="eyebrow" style={{ color: "var(--fg3)" }}>
                    {fact.label}
                  </dt>
                  <dd className="stack-1" style={{ margin: 0, color: "var(--fg1)", fontWeight: 500 }}>
                    <span>{fact.label === c.hero.facts[0].label ? `${when} · ${fact.value}` : fact.value}</span>
                    {fact.href &&
                      (fact.href.startsWith("http") ? (
                        <a href={fact.href} target="_blank" rel="noopener noreferrer">
                          {fact.linkLabel}
                        </a>
                      ) : (
                        <Link href={`${fact.href}${langSuffix(lang)}`}>{fact.linkLabel}</Link>
                      ))}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="body-lg" style={{ maxWidth: "58ch" }}>
              {c.hero.lede}
            </p>

            <div className="stack-4">
              <span className="eyebrow">{c.schedule.eyebrow}</span>
              <h2>{c.schedule.title}</h2>
              <ol className="stack-3" style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {c.schedule.slots.map((slot) => (
                  <li key={slot.time} className="stack-1">
                    <span className="mono" style={{ color: "var(--fg3)" }}>
                      {slot.time}
                    </span>
                    <strong style={{ display: "block" }}>{slot.title}</strong>
                    <span className="body-sm">{slot.note}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <Link className="btn btn--primary" href={`/${langSuffix(lang)}#signup`}>
                {a.upcomingCta}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
