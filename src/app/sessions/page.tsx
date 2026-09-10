import type { Metadata } from "next";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SessionRow } from "@/components/SessionRow";
import { SiteHeader } from "@/components/SiteHeader";
import { archiveTotals, buildArchive } from "@/lib/archive";
import { getCopy, resolveLang } from "@/lib/content";
import { countCheckins, countSignups, listWallMembers, listWharfQuestions } from "@/lib/db";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

// Reads Postgres, and the wall changes whenever anyone edits a card.
export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).archive;

  return {
    title: c.meta.title,
    description: c.meta.description,
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: c.meta.title }],
    },
  };
}

/**
 * The archive — every session, and what happened at it.
 *
 * A session was not a thing on this site until now. The photos were on the
 * home page, the questions were on the Wharf, and who came was on the member
 * wall in recency order. Three pages each held a slice, and nothing could
 * answer "what happened on the third Thursday".
 *
 * **The same privacy gate as the Wharf, for the same reason.** People and
 * questions come from `listWallMembers()`, which filters on `published_at IS
 * NOT NULL AND NOT hidden` in SQL. `countSignups()` is a scalar and returns no
 * rows at all. There is deliberately no `listSignups()` here: a public page has
 * no business holding a table of names, emails and WeChat IDs to print a
 * number. A test pins this down.
 *
 * ⚠️ And no headcounts are computed. How many people were actually in the room
 * is in each session's hand-written note, which says both how many signed up
 * and how many came — numbers this site has measured to be different, once by
 * enough to matter.
 */
export default async function SessionsPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const a = c.archive;

  const [wall, questions, signups, attendance] = await Promise.all([
    listWallMembers(),
    listWharfQuestions(),
    countSignups(),
    countCheckins(),
  ]);

  const rows = buildArchive(c.gallery.sessions, wall, questions, attendance);
  const totals = archiveTotals(
    rows,
    wall.length,
    signups,
    questions.filter((question) => question.lane === "question").length,
  );

  const stats = [
    { label: a.totals.sessions, value: totals.sessions, unit: a.totals.sessionsUnit },
    { label: a.totals.signups, value: totals.signups, unit: a.totals.signupsUnit },
    { label: a.totals.cards, value: totals.cards, unit: a.totals.cardsUnit },
    { label: a.totals.questions, value: totals.questions, unit: a.totals.questionsUnit },
  ];

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/sessions" />

      <main id="main">
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{a.eyebrow}</span>
              <h1>{a.title}</h1>
              <p className="body-lg" style={{ maxWidth: "58ch" }}>
                {a.lede}
              </p>
            </div>

            {/* The running totals. Every one of them counts something that is
                already public, and every one is labelled as what it counts. */}
            <div className="stack-3">
              <dl className="totals">
                {stats.map((stat) => (
                  <div className="totals__item" key={stat.label}>
                    <dd className="totals__value">
                      {stat.value}
                      {stat.unit && <span className="totals__unit">{stat.unit}</span>}
                    </dd>
                    <dt className="totals__label">{stat.label}</dt>
                  </div>
                ))}
              </dl>
              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {a.totalsNote} {a.attendedNote}
              </p>
            </div>

            <ol className="archive">
              {rows.map((row, index) => (
                <SessionRow
                  key={row.date}
                  row={row}
                  lang={lang}
                  copy={a}
                  eager={index === 0}
                  href={`/sessions/${row.date}${langSuffix(lang)}`}
                />
              ))}
            </ol>

            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Link className="btn btn--secondary" href={`/wharf${langSuffix(lang)}`}>
                {a.backToWharf}
              </Link>
              <Link className="btn btn--secondary" href={`/members${langSuffix(lang)}`}>
                {c.wharf.membersCta}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
