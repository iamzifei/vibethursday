import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SignupForm } from "@/components/SignupForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, LANG_PARAM, resolveLang } from "@/lib/content";
import { langHref } from "@/lib/nav";
import { eventJsonLd, pageAlternates } from "@/lib/seo";
import { formatSession } from "@/lib/sessions";
import { siteUrl } from "@/lib/site";

/**
 * The two NSW Small Business Month sessions, and where you sign up for them.
 *
 * This is the address in the "Book now" button on this event's own page on
 * nsw.gov.au. Everyone arriving has therefore come from a government events
 * calendar rather than from the WeChat group, has never heard of the meetup,
 * and is deciding in about eight seconds whether it is for them — so the page
 * repeats everything the home page is entitled to assume.
 *
 * 🔴 The constraint that shapes it: the program's terms forbid an event being
 * used to promote products or services, "even if they have a free component
 * such as a 'try before you buy' arrangement". Nothing here is for sale, and
 * the section that says so is on the page rather than in a footnote, because
 * the reader's live question at a government-listed free event is what the
 * catch is.
 *
 * The signup form is the real one, posting to the real endpoint, so these
 * registrations land in the same table as every other week's and need no
 * separate reconciliation. What differs is the session picker: it offers the
 * two October dates and nothing else.
 */

/** The two Thursdays listed with the NSW Small Business Commission. */
const SBM_SESSIONS = ["2026-10-08", "2026-10-15"] as const;

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang).sbm;

  return {
    alternates: pageAlternates("/sbm", lang),
    title: c.meta.title,
    description: c.meta.description,
    // Repeated rather than inherited: declaring openGraph at all replaces the
    // parent object, so leaving images out would drop the social card.
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: c.meta.title }],
    },
  };
}

export default async function SbmPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const s = c.sbm;

  // Only the two listed dates. The signup route independently checks the date
  // against the next twelve Thursdays, so a stale option cannot write a date
  // nobody is running.
  const sessions = SBM_SESSIONS.map((value) => ({
    value,
    label: `${formatSession(value, lang)} · ${c.signup.fields.sessionTimeSuffix}`,
  }));

  // One Event per session, titled the way the government listing titles them
  // rather than by date, since that is the name a search result will show.
  const events = SBM_SESSIONS.map((date, index) =>
    eventJsonLd(date, lang, c, {
      title: s.sessions[index].title,
      description: s.sessions[index].body,
      url: `${siteUrl()}/sbm${lang === "zh" ? "" : `?lang=${LANG_PARAM[lang]}`}#signup`,
    }),
  );

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={events} />
      <SiteHeader lang={lang} copy={c} path="/sbm" />

      <main id="main">
        {/* ── What this is ─────────────────────────────────────────── */}
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "680px" }}>
            <div className="stack-4">
              <span className="eyebrow">{s.eyebrow}</span>
              <h1>{s.title}</h1>
              <p className="body-lg">{s.lede}</p>
              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {s.fromGov}
              </p>
            </div>

            {/* ── The two sessions ───────────────────────────────── */}
            <div className="stack-4">
              <h2 className="h3">{s.sessionsTitle}</h2>
              {s.sessions.map((session) => (
                <div className="stack-2" key={session.date}>
                  <p className="body-sm" style={{ color: "var(--fg3)" }}>
                    {session.date}
                  </p>
                  <h3 className="h4">{session.title}</h3>
                  <p>{session.body}</p>
                </div>
              ))}
            </div>

            {/* ── What the room is like ──────────────────────────── */}
            <div className="stack-4">
              <h2 className="h3">{s.formatTitle}</h2>
              <ul className="stack-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {s.format.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {/* ── First time here ────────────────────────────────── */}
            <div className="stack-4">
              <h2 className="h3">{s.newcomerTitle}</h2>
              <p>{s.newcomerBody}</p>
              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {s.newcomerNote}
              </p>
            </div>

            {/* ── What will not happen ───────────────────────────── */}
            <div className="stack-4">
              <h2 className="h3">{s.noSellingTitle}</h2>
              <ol className="stack-4" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {s.noSelling.map((rule, index) => (
                  <li className="rule" key={rule}>
                    <span className="rule__num">{String(index + 1).padStart(2, "0")}</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {s.noSellingNote}
              </p>
            </div>
          </div>
        </section>

        {/* ── Signup ───────────────────────────────────────────────── */}
        <section className="section" id="signup">
          <div className="shell stack-8">
            <div className="stack-4">
              <h2>{s.signupTitle}</h2>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {s.signupLede}
              </p>
            </div>

            <SignupForm
              lang={lang}
              copy={c.signup}
              sessions={sessions}
              turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
            />

            <p className="body-sm" style={{ color: "var(--fg3)", maxWidth: "62ch" }}>
              {s.acknowledgement}
            </p>

            <p className="body-sm">
              <Link href={langHref("/", lang)}>{s.back}</Link>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
