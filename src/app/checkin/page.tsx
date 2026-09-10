import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { buildRoster, canCheckIn, isSessionDate, verifyCheckinCode, type RosterEntry } from "@/lib/checkin";
import { getCopy, LANG_PARAM, resolveLang, type Lang } from "@/lib/content";
import { listCheckins, listRoster } from "@/lib/db";
import { formatSession, sydneyToday } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{
    lang?: string;
    /** Session date, from the QR. */
    s?: string;
    /** Session code, from the QR. */
    k?: string;
    /** A roster id: show the confirm step for this person. */
    who?: string;
    /** "1": show the walk-in form. */
    new?: string;
    /** A roster id that just checked in: show the done step. */
    done?: string;
    /** What went wrong on the last post. */
    err?: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).checkin;
  // The code in the URL is the whole point; a search result would be a link
  // that does not work on any day but one.
  return { title: c.meta.title, robots: { index: false } };
}

/** The page's own URL with the code kept and one step's parameters added. */
function stepHref(session: string, code: string, lang: Lang, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ s: session, k: code, ...extra });
  const param = LANG_PARAM[lang];
  if (param) params.set("lang", param);
  return `/checkin?${params.toString()}`;
}

/**
 * The page a phone lands on after scanning the code on the table.
 *
 * Four steps, all on this one route and all plain HTML: the roster, a
 * confirm step for the name that was tapped, a walk-in form, and a done
 * screen. State lives in the query string, so the back button is the
 * "not me" button and nothing needs a script to work on a phone whose
 * browser is whatever WeChat opens links in.
 */
export default async function CheckinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);
  const t = c.checkin;

  const session = params.s ?? "";
  const code = params.k ?? "";

  const shell = (children: ReactNode) => (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/checkin" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "640px" }}>{children}</div>
        </section>
      </main>
      <SiteFooter lang={lang} copy={c} />
    </div>
  );

  // No code at all: someone typed the address. Tell them where the door is.
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
  const valid = isSessionDate(session) && verifyCheckinCode(session, code) && canCheckIn(session, today);

  // A wrong code and a right code on the wrong day get the same page: the
  // fix is the same for both, and the difference is nobody's business.
  if (!valid) {
    return shell(
      <div className="stack-4">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.invalidTitle}</h1>
        <p className="body-lg">{t.invalidBody}</p>
      </div>,
    );
  }

  const [signups, checkins] = await Promise.all([listRoster(session), listCheckins(session)]);
  const roster = buildRoster(session, signups, checkins);
  const hasCard = new Map(signups.map((row) => [row.id, row.has_card]));
  const count = checkins.length;

  const error =
    params.err === "rate" ? t.rateLimited
    : params.err === "failed" ? t.failed
    : params.err === "name" ? t.walkInMissing
    : null;

  const heading = (
    <div className="stack-4">
      <span className="eyebrow">
        {t.eyebrow} · {formatSession(session, lang)}
      </span>
      <h1>{t.title}</h1>
      <p className="body-lg">{t.lede}</p>
      <p className="mono" style={{ color: "var(--fg3)" }}>
        {t.count.replace("{n}", String(count))}
      </p>
    </div>
  );

  // ── Done ──────────────────────────────────────────────────────────
  if (params.done) {
    const me = roster.find((entry) => entry.id === params.done);

    return shell(
      <>
        <div className="stack-4">
          <span className="eyebrow">
            {t.eyebrow} · {formatSession(session, lang)}
          </span>
          <h1>{t.doneTitle}</h1>
          {me && (
            <p className="body-lg">
              <strong>{me.name}</strong> · {t.done}
            </p>
          )}
          <p className="body-lg">{t.doneBody.replace("{n}", String(count))}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Link className="btn btn--primary" href={`/sessions/${session}${langSuffix(lang)}`}>
            {t.doneWall}
          </Link>
          <Link className="btn btn--secondary" href={`/${langSuffix(lang)}`}>
            {t.doneHome}
          </Link>
        </div>
      </>,
    );
  }

  // ── Confirm one name ──────────────────────────────────────────────
  const who = params.who ? roster.find((entry) => entry.id === params.who) : undefined;

  if (who) {
    return shell(
      <>
        <div className="stack-4">
          <span className="eyebrow">
            {t.eyebrow} · {formatSession(session, lang)}
          </span>
          <h1>{t.confirmTitle.replace("{name}", who.name)}</h1>
          {who.hint && <p className="body-lg" style={{ color: "var(--fg2)" }}>{who.hint}</p>}
        </div>

        <div className="stack-3">
          <p>{t.wallExplain}</p>
          <p className="body-sm" style={{ color: "var(--fg3)" }}>
            {hasCard.get(who.id) ? t.wallExplainCard : t.wallExplainLight}
          </p>
        </div>

        <WallChoice session={session} code={code} lang={lang} signupId={who.id} copy={t} />

        <p>
          <Link href={stepHref(session, code, lang)}>{t.notMe}</Link>
        </p>
      </>,
    );
  }

  // ── Walk-in ───────────────────────────────────────────────────────
  if (params.new === "1") {
    return shell(
      <>
        <div className="stack-4">
          <span className="eyebrow">
            {t.eyebrow} · {formatSession(session, lang)}
          </span>
          <h1>{t.walkInTitle}</h1>
          <p className="body-lg">{t.walkInLede}</p>
        </div>

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <form method="post" action="/api/checkin" className="stack-6">
          <input type="hidden" name="session" value={session} />
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="lang" value={lang} />

          <div>
            <label className="label" htmlFor="walkin-name">
              {t.walkInName}
            </label>
            <input className="field" id="walkin-name" name="name" required maxLength={100} autoComplete="name" />
          </div>

          <div>
            <label className="label" htmlFor="walkin-building">
              {t.walkInBuilding}
            </label>
            <textarea
              className="field"
              id="walkin-building"
              name="building"
              rows={2}
              maxLength={1000}
              placeholder={t.walkInBuildingPlaceholder}
            />
          </div>

          <div>
            <label className="label" htmlFor="walkin-wechat">
              {t.walkInWechat}
            </label>
            <input className="field" id="walkin-wechat" name="wechat" maxLength={100} autoComplete="off" />
            <p className="field-hint">{t.walkInWechatHint}</p>
          </div>

          <div className="stack-3">
            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              {t.wallExplain} {t.wallExplainLight}
            </p>
            <button className="btn btn--primary btn--block" type="submit" name="onWall" value="yes">
              {t.yesWall}
            </button>
            <button className="btn btn--secondary btn--block" type="submit" name="onWall" value="no">
              {t.noWall}
            </button>
          </div>
        </form>

        <p>
          <Link href={stepHref(session, code, lang)}>{t.notMe}</Link>
        </p>
      </>,
    );
  }

  // ── The roster ────────────────────────────────────────────────────
  return shell(
    <>
      {heading}

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      <ul className="roster">
        {roster.map((entry) => (
          <RosterLine key={entry.id} entry={entry} href={stepHref(session, code, lang, { who: entry.id })} doneLabel={t.done} />
        ))}
      </ul>

      <p>
        <Link className="btn btn--secondary" href={stepHref(session, code, lang, { new: "1" })}>
          {t.walkInCta}
        </Link>
      </p>
    </>,
  );
}

/** One name on the list. A link, so the whole row is the tap target. */
function RosterLine({ entry, href, doneLabel }: { entry: RosterEntry; href: string; doneLabel: string }) {
  return (
    <li className={`roster__row${entry.checkedIn ? " roster__row--done" : ""}`}>
      <Link href={href} className="roster__link">
        <span className="roster__name">{entry.name}</span>
        {entry.hint && <span className="roster__hint">{entry.hint}</span>}
        {entry.checkedIn && <span className="roster__done">✓ {doneLabel}</span>}
      </Link>
    </li>
  );
}

/** The two buttons. Two, on purpose: neither is a default. */
function WallChoice({
  session,
  code,
  lang,
  signupId,
  copy,
}: {
  session: string;
  code: string;
  lang: Lang;
  signupId: string;
  copy: { yesWall: string; noWall: string };
}) {
  return (
    <form method="post" action="/api/checkin" className="stack-3">
      <input type="hidden" name="session" value={session} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="signupId" value={signupId} />
      <button className="btn btn--primary btn--block" type="submit" name="onWall" value="yes">
        {copy.yesWall}
      </button>
      <button className="btn btn--secondary btn--block" type="submit" name="onWall" value="no">
        {copy.noWall}
      </button>
    </form>
  );
}
