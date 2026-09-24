import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, resolveLang } from "@/lib/content";
import { canGiveFeedback, isSessionDate, RATINGS, verifyFeedbackCode } from "@/lib/feedback";
import { formatSession, sydneyToday } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{
    lang?: string;
    /** Session date, from the code handed out at the end. */
    s?: string;
    /** Session code. */
    k?: string;
    /** "1": the form went in, show the thank-you. */
    done?: string;
    /** What went wrong on the last post. */
    err?: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).feedback;
  // Same reasoning as /checkin: the code in the URL is the whole point, so a
  // search result would be a link that works for nobody.
  return { title: c.meta.title, robots: { index: false } };
}

/**
 * Saying what a session was like, afterwards.
 *
 * ★ This is the only page on the site that asks a question the site cannot
 * answer by itself. It knows who signed up, who turned up and what people
 * wanted to ask; whether the morning was any good is only knowable by asking,
 * and until now it was not asked anywhere.
 *
 * Plain HTML and a form post, like `/checkin` and for the same reason: this
 * opens on a phone, usually from a link in a group chat, in whatever browser
 * WeChat decides to use. Nothing here needs script to work. State is in the
 * query string, so the back button behaves and a reload cannot repost.
 *
 * Anonymous unless somebody types their own name into the last box.
 */
export default async function FeedbackPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);
  const t = c.feedback;

  const session = params.s ?? "";
  const code = params.k ?? "";

  const shell = (children: ReactNode) => (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/feedback" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "640px" }}>{children}</div>
        </section>
      </main>
      <SiteFooter lang={lang} copy={c} />
    </div>
  );

  // No code at all: somebody typed the address.
  if (!session && !code) {
    return shell(
      <div className="stack-4">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.noCodeTitle}</h1>
        <p className="body-lg">{t.noCodeBody}</p>
      </div>,
    );
  }

  const today = sydneyToday().toISOString().slice(0, 10);
  const open = isSessionDate(session) && verifyFeedbackCode(session, code) && canGiveFeedback(session, today);

  // ⚠️ A wrong code and a closed window get the same page, deliberately — the
  // same call `/checkin` makes. The fix is the same for both (get the current
  // code), and which of the two it was is nobody's business.
  if (!open) {
    return shell(
      <div className="stack-4">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.closedTitle}</h1>
        <p className="body-lg">{t.closedBody}</p>
      </div>,
    );
  }

  const heading = (
    <span className="eyebrow">
      {t.eyebrow} · {formatSession(session, lang)}
    </span>
  );

  // ── Done ──────────────────────────────────────────────────────────
  if (params.done) {
    return shell(
      <>
        <div className="stack-4">
          {heading}
          <h1>{t.doneTitle}</h1>
          <p className="body-lg">{t.doneBody}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Link className="btn btn--primary" href={`/sessions/${session}${langSuffix(lang)}`}>
            {t.doneSession}
          </Link>
          <Link className="btn btn--secondary" href={`/${langSuffix(lang)}`}>
            {t.doneHome}
          </Link>
        </div>
      </>,
    );
  }

  const error =
    params.err === "empty" ? { title: t.emptyTitle, body: t.empty }
    : params.err === "rate" ? { title: null, body: t.rateLimited }
    : params.err === "failed" ? { title: null, body: t.failed }
    : null;

  const recommendOptions = [
    { value: "yes", label: t.recommendYes },
    { value: "maybe", label: t.recommendMaybe },
    { value: "no", label: t.recommendNo },
  ];

  // ── The form ──────────────────────────────────────────────────────
  return shell(
    <>
      <div className="stack-4">
        {heading}
        <h1>{t.title}</h1>
        <p className="body-lg">{t.lede}</p>
      </div>

      {error && (
        <p className="alert alert--error" role="alert">
          {error.title ? `${error.title} ${error.body}` : error.body}
        </p>
      )}

      <form method="post" action="/api/feedback" className="stack-8">
        <input type="hidden" name="session" value={session} />
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="lang" value={lang} />

        {/* Five buttons rather than a slider or a select: both of those need
            script or a second tap, and this is the one answer that has to be
            comparable between one Thursday and the next. */}
        <fieldset className="stack-3">
          <legend className="label">{t.ratingLabel}</legend>
          <div className="choice-group choice-group--compact">
            {RATINGS.map((value) => (
              <label className="choice" key={value}>
                <input type="radio" name="rating" value={value} />
                <span>{value}</span>
              </label>
            ))}
          </div>
          <p className="field-hint">
            1 = {t.ratingLow} · 5 = {t.ratingHigh}
          </p>
        </fieldset>

        <fieldset className="stack-3">
          <legend className="label">{t.recommendLabel}</legend>
          <div className="choice-group">
            {recommendOptions.map((option) => (
              <label className="choice" key={option.value}>
                <input type="radio" name="recommend" value={option.value} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="feedback-best">
            {t.bestLabel}
          </label>
          <textarea
            className="field"
            id="feedback-best"
            name="best"
            rows={3}
            maxLength={2000}
            placeholder={t.bestPlaceholder}
          />
        </div>

        <div>
          <label className="label" htmlFor="feedback-better">
            {t.betterLabel}
          </label>
          <textarea
            className="field"
            id="feedback-better"
            name="better"
            rows={3}
            maxLength={2000}
            placeholder={t.betterPlaceholder}
          />
        </div>

        <div>
          <label className="label" htmlFor="feedback-name">
            {t.nameLabel}
          </label>
          <input className="field" id="feedback-name" name="name" maxLength={100} autoComplete="name" />
          <p className="field-hint">{t.nameHint}</p>
        </div>

        <button className="btn btn--primary btn--block" type="submit">
          {t.submit}
        </button>
      </form>
    </>,
  );
}
