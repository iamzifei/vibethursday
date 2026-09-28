import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, resolveLang } from "@/lib/content";
import { getMySignup, type MySignup } from "@/lib/db";
import { canChangeSession, verifyMyToken } from "@/lib/my-signup";
import { formatSession, nextThursdays, sydneyToday } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{
    lang?: string;
    /** The signed lookup token from /api/my. */
    t?: string;
    /** What the last change did: cancel · booked · waitlist. */
    done?: string;
    /** The session that change was about. */
    d?: string;
    /** What went wrong: notfound · name · rate · expired · failed. */
    err?: string;
    /** With err=name: the first and last letter of the name on file (`nameHint`). */
    h?: string;
    /** With err=name: the WeChat ID they typed, handed back so it need not be typed again. */
    w?: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).my;
  // Personal by construction: a search result would be a page that works for
  // nobody but the person who looked themselves up.
  return { title: c.meta.title, robots: { index: false } };
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/**
 * /my — "did my signup go through?", "move me to next week", "I can't come".
 *
 * Added 2026-09-28. Before this the answer to all three was a message to the
 * organiser: the site never showed anybody their own sessions, and a signup
 * could only ever gain sessions, never lose one.
 *
 * Plain forms posting to /api/my and landing back here, like /order and
 * /feedback, because this is opened from a WeChat chat in WeChat's browser.
 */
export default async function MyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);
  const t = c.my;

  const token = params.t ?? "";
  const signupId = verifyMyToken(token);

  let mine: MySignup | null = null;
  if (signupId) {
    try {
      mine = await getMySignup(signupId);
    } catch (error) {
      console.error("[my] could not load a signup", error);
    }
  }

  const shell = (children: ReactNode) => (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/my" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "640px" }}>
            <div className="stack-4">
              <span className="eyebrow">{t.eyebrow}</span>
              <h1>{t.title}</h1>
            </div>
            {children}
            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              {t.goHint}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} copy={c} />
    </div>
  );

  const errorText =
    params.err === "notfound" ? t.notFound
    : params.err === "name" && params.h ? fill(t.nameMismatch, { hint: params.h.slice(0, 8) })
    : params.err === "rate" ? t.rateLimited
    : params.err === "expired" || (token && !mine) ? t.expired
    : params.err === "failed" ? t.failed
    : null;

  const error = errorText && (
    <p className="alert alert--error" role="alert">
      {errorText}
    </p>
  );

  // ── Not looked up yet (or the token ran out) ─────────────────────
  if (!mine) {
    return shell(
      <>
        <p className="body-lg">{t.lede}</p>
        {error}
        <form method="post" action="/api/my" className="stack-6">
          <input type="hidden" name="action" value="lookup" />
          <input type="hidden" name="lang" value={lang} />
          <div>
            <label className="label" htmlFor="my-name">
              {t.nameLabel}
            </label>
            <input className="field" id="my-name" name="name" maxLength={60} autoComplete="name" required />
          </div>
          <div>
            <label className="label" htmlFor="my-wechat">
              {t.wechatLabel}
            </label>
            <input
              className="field"
              id="my-wechat"
              name="wechat"
              maxLength={60}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              defaultValue={params.err === "name" ? (params.w ?? "").slice(0, 60) : undefined}
              required
            />
            <p className="field-hint">{t.wechatHint}</p>
          </div>
          <button className="btn btn--primary btn--block" type="submit">
            {t.lookup}
          </button>
        </form>
      </>,
    );
  }

  // ── Looked up ────────────────────────────────────────────────────
  const today = sydneyToday().toISOString().slice(0, 10);
  const upcoming = [
    ...mine.sessions.filter((s) => canChangeSession(s, today)).map((session) => ({ session, position: null as number | null })),
    ...mine.waitlist.filter((w) => canChangeSession(w.session, today)),
  ].sort((a, b) => (a.session < b.session ? -1 : 1));
  const pastCount = mine.sessions.filter((s) => !canChangeSession(s, today)).length;

  const held = new Set(upcoming.map((entry) => entry.session));
  const choices = nextThursdays(6).filter((session) => !held.has(session));

  const doneText =
    params.done && params.d
      ? params.done === "cancel" ? fill(t.doneCancel, { date: formatSession(params.d, lang) })
      : params.done === "booked" ? fill(t.doneBooked, { date: formatSession(params.d, lang) })
      : params.done === "waitlist"
        ? fill(t.doneWaitlist, {
            date: formatSession(params.d, lang),
            n: mine.waitlist.find((w) => w.session === params.d)?.position ?? "?",
          })
      : null
      : null;

  const hidden = (
    <>
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="lang" value={lang} />
    </>
  );

  return shell(
    <>
      {doneText && (
        <p className="alert" role="status">
          {doneText}
        </p>
      )}
      {error}

      <div className="stack-4">
        <p className="body-lg" style={{ margin: 0 }}>
          {fill(t.hello, { name: mine.name })}
        </p>

        {upcoming.length === 0 ? (
          <p className="body">{t.none}</p>
        ) : (
          <ul className="my-list">
            {upcoming.map((entry) => (
              <li className="my-row" key={entry.session}>
                <div className="my-row__head">
                  <strong>{formatSession(entry.session, lang)}</strong>
                  <span className={entry.position === null ? "chip" : "chip chip--quiet"}>
                    {entry.position === null ? t.booked : fill(t.waitlisted, { n: entry.position })}
                  </span>
                </div>
                {entry.position !== null && <p className="field-hint">{t.waitlistNote}</p>}

                <div className="my-row__actions">
                  {choices.length > 0 && (
                    <form method="post" action="/api/my" className="my-move">
                      {hidden}
                      <input type="hidden" name="action" value="move" />
                      <input type="hidden" name="from" value={entry.session} />
                      <label className="label" htmlFor={`my-move-${entry.session}`}>
                        {t.moveLabel}
                      </label>
                      <select className="field" id={`my-move-${entry.session}`} name="to" required defaultValue="">
                        <option value="" disabled>
                          {t.addLabel}
                        </option>
                        {choices.map((session) => (
                          <option key={session} value={session}>
                            {formatSession(session, lang)}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn--secondary" type="submit">
                        {t.moveSubmit}
                      </button>
                    </form>
                  )}

                  <details className="confirm">
                    <summary className="linkish">{t.cancel}</summary>
                    <form method="post" action="/api/my">
                      {hidden}
                      <input type="hidden" name="action" value="cancel" />
                      <input type="hidden" name="from" value={entry.session} />
                      <button className="btn btn--secondary" type="submit" style={{ color: "var(--warning)" }}>
                        {t.cancelConfirm}
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pastCount > 0 && (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>
            {fill(t.past, { n: pastCount })}
          </p>
        )}
      </div>

      {/* Folded: adding another Thursday is the rare case, and left open it
          read as the next step — one person ended up down for five fallbacks
          while waiting for the week they wanted (2026-09-28). */}
      {choices.length > 0 && (
        <details className="disclosure">
          <summary>{t.addTitle}</summary>
        <form method="post" action="/api/my" className="stack-3 disclosure__body">
          {hidden}
          <input type="hidden" name="action" value="move" />
          <label className="label" htmlFor="my-add">
            {t.addLabel}
          </label>
          <select className="field" id="my-add" name="to" required defaultValue="">
            <option value="" disabled>
              {t.addLabel}
            </option>
            {choices.map((session) => (
              <option key={session} value={session}>
                {formatSession(session, lang)}
              </option>
            ))}
          </select>
          <button className="btn btn--secondary" type="submit">
            {t.addSubmit}
          </button>
        </form>
        </details>
      )}

      <p className="body-sm" style={{ color: "var(--fg3)" }}>
        {t.validFor} <Link href={`/my${langSuffix(lang)}`}>{t.another}</Link>
      </p>
    </>,
  );
}
