import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { RELEASES, releaseDate, type Release } from "@/lib/changelog";
import { getCopy, resolveLang, type Lang } from "@/lib/content";
import { pageAlternates } from "@/lib/seo";
import { toTraditional } from "@/lib/traditional";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang).changelog;

  return {
    title: c.meta.title,
    description: c.meta.description,
    alternates: pageAlternates("/changelog", lang),
  };
}

/**
 * What has changed about the meetup, with version numbers.
 *
 * ★ The point of publishing this is the same as the point of publishing the
 * source: the meetup is built the way the software is, in the open and by
 * iteration, and a version number is the shortest way to say so. It also does
 * something no other page does — it makes the changes legible to somebody who
 * came once in August and is deciding whether to come back.
 *
 * The entries live in `src/lib/changelog.ts`, not in the copy bundle: a
 * release has a number and a date that must exist exactly once, and keeping
 * two translations of those side by side is how one of them ends up wrong.
 * The prose is written in Chinese and English there, and Traditional is
 * converted here — the same treatment the rest of the site's copy gets, just
 * applied at the point of use.
 */
export default async function ChangelogPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const t = c.changelog;

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/changelog" />

      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "760px" }}>
            <div className="stack-4">
              <span className="eyebrow">{t.eyebrow}</span>
              <h1>{t.title}</h1>
              <p className="body-lg">{t.lede}</p>

              <p className="mono" style={{ color: "var(--fg3)" }}>
                {t.current} <span className="hl">v{RELEASES[0].version}</span>
              </p>
            </div>

            {/* What the two kinds mean, said once rather than implied by two
                differently coloured chips nobody has a key for. */}
            <dl className="stack-3" style={{ margin: 0 }}>
              <div className="stack-2">
                <dt className="chip chip--stage" style={{ alignSelf: "flex-start" }}>{t.major}</dt>
                <dd className="body-sm" style={{ margin: 0, color: "var(--fg2)" }}>{t.majorNote}</dd>
              </div>
              <div className="stack-2">
                <dt className="chip chip--quiet" style={{ alignSelf: "flex-start" }}>{t.minor}</dt>
                <dd className="body-sm" style={{ margin: 0, color: "var(--fg2)" }}>{t.minorNote}</dd>
              </div>
            </dl>

            <ol className="stack-6" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {RELEASES.map((release) => (
                <li key={release.version} className="card stack-3">
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-3)",
                      alignItems: "baseline",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="h3 mono hl">v{release.version}</span>
                    <span className={release.kind === "major" ? "chip chip--stage" : "chip chip--quiet"}>
                      {release.kind === "major" ? t.major : t.minor}
                    </span>
                    <span className="body-sm mono" style={{ color: "var(--fg3)" }}>
                      {releaseDate(release.date, lang)}
                    </span>
                  </div>

                  <p className="body-lg" style={{ margin: 0 }}>{line(release, lang)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}

/** One release's sentence, in the reader's script. */
function line(release: Release, lang: Lang): string {
  if (lang === "en") return release.en;
  return lang === "zh-Hant" ? toTraditional(release.zh) : release.zh;
}
