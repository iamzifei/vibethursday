import type { Metadata } from "next";
import { SignupForm } from "@/components/SignupForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { capFor } from "@/lib/capacity";
import { getCopy, resolveLang } from "@/lib/content";
import { signupCountsBySession } from "@/lib/db";
import { langHref } from "@/lib/nav";
import { pageAlternates } from "@/lib/seo";
import { formatSession, upcomingSpecialSessions } from "@/lib/sessions";

// The form shows which Tuesdays are full, so this reads the database per request.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const t = getCopy(lang).tuesday;

  return { alternates: pageAlternates("/tuesday", lang), title: t.meta.title, description: t.meta.description };
}

/**
 * Build Tuesday: a small-room morning for people who build things
 * (decided 2026-10-04).
 *
 * Thursday had outgrown its room, and the people who most wanted to look
 * closely at each other's work were the ones a crowded room served worst. This
 * page exists to move some of them here, so it says plainly who it is for and
 * who would be better off on Thursday.
 *
 * The form is the home page's own, offered only the open Tuesdays, so a
 * signup here lands in the same table, the same /my and the same admin as
 * every Thursday signup.
 */
export default async function TuesdayPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const t = c.tuesday;

  const counts = await signupCountsBySession().catch(() => new Map<string, number>());
  const sessions = upcomingSpecialSessions().map(({ date }) => {
    const full = (counts.get(date) ?? 0) >= capFor(date);
    return {
      value: date,
      label: `${formatSession(date, lang)} · ${c.signup.sessionTimeSuffixTuesday}` + (full ? ` · ${c.signup.fields.sessionFull}` : ""),
      full,
      tuesday: true,
    };
  });
  const next = sessions[0];

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/tuesday" />

      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "680px" }}>
            <div className="stack-4">
              <span className="eyebrow">{t.eyebrow}</span>
              <h1>{t.title}</h1>
              <p className="body-lg">{t.lede}</p>
            </div>

            <div className="stack-4">
              <h2 className="h3">{t.factsTitle}</h2>
              {next ? (
                <dl className="stack-3" style={{ margin: 0 }}>
                  {/* The date first, from the same label the form uses, then
                      the fixed facts. */}
                  <div className="card stack-1">
                    <dt className="eyebrow" style={{ color: "var(--fg3)" }}>
                      {c.signup.fields.session}
                    </dt>
                    <dd style={{ margin: 0, color: "var(--fg1)", fontWeight: 600 }}>{formatSession(next.value, lang)}</dd>
                  </div>
                  {t.facts.map((fact) => (
                    <div className="card stack-1" key={fact.label}>
                      <dt className="eyebrow" style={{ color: "var(--fg3)" }}>
                        {fact.label}
                      </dt>
                      <dd style={{ margin: 0, color: "var(--fg1)" }}>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="body-lg">{t.noSession}</p>
              )}
              <p className="body-sm">
                <a href={t.mapsUrl} target="_blank" rel="noopener noreferrer">
                  {t.mapsLabel} ↗
                </a>
              </p>
            </div>

            <div className="stack-4">
              <h2 className="h3">{t.whoTitle}</h2>
              <ul className="stack-2" style={{ margin: 0 }}>
                {t.who.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="stack-4">
              <h2 className="h3">{t.formatTitle}</h2>
              <ul className="stack-2" style={{ margin: 0 }}>
                {t.format.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="body-sm">
                {t.thursdayNote} <a href={langHref("/", lang)}>{t.thursdayLink} →</a>
              </p>
            </div>

            {next && (
              <div className="stack-4" id="signup">
                <h2 className="h3">{t.signupTitle}</h2>
                <p className="body">{t.signupLede}</p>
                <SignupForm
                  lang={lang}
                  copy={c.signup}
                  sessions={sessions}
                  turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
                />
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
