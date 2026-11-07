import type { Metadata } from "next";
import { SessionCompare } from "@/components/SessionCompare";
import { MemberUpsell } from "@/components/MemberUpsell";
import { SceneImage } from "@/components/SceneImage";
import { StickyCta } from "@/components/StickyCta";
import { SignupForm } from "@/components/SignupForm";
import { DaySwitch } from "@/components/DaySwitch";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { capFor } from "@/lib/capacity";
import { getCopy, resolveLang } from "@/lib/content";
import { signupCountsBySession } from "@/lib/db";
import { langHref } from "@/lib/nav";
import { knownProfileFromCookie } from "@/lib/known-profile";
import { wechatLoginHref } from "@/lib/login-link";
import { LANG_PARAM } from "@/lib/content";
import { pageAlternates } from "@/lib/seo";
import { formatSession, isOpenTrialSession, upcomingBookableSpecialSessions } from "@/lib/sessions";

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
  const sessions = upcomingBookableSpecialSessions().map(({ date }) => {
    const full = (counts.get(date) ?? 0) >= capFor(date);
    return {
      value: date,
      label: `${formatSession(date, lang)} · ${c.signup.sessionTimeSuffixTuesday}` + (full ? ` · ${c.signup.fields.sessionFull}` : ""),
      full,
      tuesday: true,
    };
  });
  const next = sessions[0];
  // The open-trial Tuesday (2026-11-06), while it still takes signups.
  const trial = sessions.find((session) => isOpenTrialSession(session.value));
  const trialNote = trial ? t.trialNote.replace("{date}", formatSession(trial.value, lang)) : null;
  const knownProfile = await knownProfileFromCookie();

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/tuesday" />

      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "680px" }}>
            {/* Phone first (2026-11-02): what it is in four chips and a picture,
                the day in three cards, then the form — the details and the
                comparison with Thursday come after it, for whoever wants them. */}
            <div className="stack-4">
              <span className="eyebrow">{t.eyebrow}</span>
              <h1>{t.title}</h1>
              <p className="body-lg" style={{ margin: 0 }}>{t.lede}</p>
              {trialNote && <p className="body" style={{ margin: 0 }}><strong>{trialNote}</strong></p>}
              <ul className="chips">
                {t.chips.map((chip) => <li key={chip}>{chip}</li>)}
              </ul>
              <div className="cta-row">
                <a className="btn btn--primary" href="#signup">{t.cta}</a>
                <a className="body" href="/join">{t.ctaMember}</a>
              </div>
            </div>

            <SceneImage id="scene-1" alt={t.sceneAlt} eager />

            <div className="stack-4">
              <h2 className="h3">{t.formatTitle}</h2>
              <ol className="steps">
                {t.format.map((step) => (
                  <li key={step.time}>
                    <span className="mono">{step.time}</span>
                    <strong>{step.title}</strong>
                    <p>{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="stack-3">
              <h2 className="h3">{t.whoTitle}</h2>
              <ul className="stack-2" style={{ margin: 0 }}>
                {t.who.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>

            {next ? (
              <div className="stack-4" id="signup">
                {/* Thursday or Tuesday, one tap either way (2026-11-02). */}
                <DaySwitch lang={lang} copy={c.daySwitch} current="tuesday" />
                <h2 className="h3">{t.signupTitle}</h2>
                <p className="body">{trialNote ? t.signupLedeTrial : t.signupLede}</p>
                {trialNote && <p className="body"><strong>{trialNote}</strong></p>}
                <SignupForm
                  lang={lang}
                  copy={c.signup}
                  sessions={sessions}
                  knownProfile={knownProfile}
                  wechatBind={(() => {
                    const href = knownProfile && !knownProfile.wechatLinked ? wechatLoginHref("/tuesday#signup", LANG_PARAM[lang]) : null;
                    return href ? { href, label: c.login.bindEntry } : null;
                  })()}
                  wechatLogin={(() => {
                    const href = wechatLoginHref("/tuesday#signup", LANG_PARAM[lang]);
                    return href ? { href, label: c.login.entry, hint: c.login.entryHint, or: c.login.orFill } : null;
                  })()}
                  turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
                />
              </div>
            ) : (
              <p className="body-lg" id="signup">{t.noSession}</p>
            )}

            <MemberUpsell copy={t.memberUpsell} />

            <div className="stack-3">
              <h2 className="h3">{t.factsTitle}</h2>
              <dl className="stack-2" style={{ margin: 0 }}>
                {t.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="eyebrow" style={{ color: "var(--fg3)" }}>{fact.label}</dt>
                    <dd style={{ margin: 0, color: "var(--fg1)" }}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              {/* No map or directions here (2026-11-02): the address and map
                  are shown only to people who have paid — tuesday-venue.ts. */}
              <p className="body-sm" style={{ margin: 0 }}>
                {t.thursdayNote} <a href={langHref("/", lang)}>{t.thursdayLink} →</a>
              </p>
            </div>

            <details className="stack-3">
              <summary className="h3" style={{ cursor: "pointer" }}>{t.compareTitle}</summary>
              <SessionCompare compare={c.signup.compare} />
              <p className="body-sm">{t.compareUnsure}</p>
            </details>
          </div>
        </section>
        {next && <StickyCta href="#signup" label={t.stickyLabel} cta={t.cta} />}
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
