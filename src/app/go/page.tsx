import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, LANG_PARAM, resolveLang, type Lang } from "@/lib/content";
import { getMemberById, getMySignup, getOrder, getSessionQuestions, signupCountsBySession } from "@/lib/db";
import { readRememberToken, REMEMBER_COOKIE } from "@/lib/my-signup";
import { SESSION_CAP } from "@/lib/capacity";
import { questionsMode } from "@/lib/session-questions";
import { feedbackCode } from "@/lib/feedback";
import { CHAT_URL, checkinLinkOpen, goItems, goPhase, type GoItem } from "@/lib/go";
import { currentMemberId } from "@/lib/member-auth";
import { formatPrice } from "@/lib/menu";
import { orderCode, orderCookieName, readOrderToken } from "@/lib/order";
import { checkinCode } from "@/lib/checkin";
import { focusSession, formatSession, nextThursdays, sydneyHour, sydneyToday } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

// Changes by the day and shows the visitor their own state; never cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).go;
  return { title: c.meta.title, robots: { index: false } };
}

/** `path` with `?lang=` added the way every other internal link on the site adds it. */
function withLang(path: string, lang: Lang): string {
  const param = LANG_PARAM[lang];
  if (!param) return path;
  return `${path}${path.includes("?") ? "&" : "?"}lang=${param}`;
}

/**
 * The one link people are asked to remember.
 *
 * Pinned in the group once and printed on everything, instead of a new link
 * in a new message for every step. The rule for what shows when is
 * `goItems` in `lib/go.ts`; this page only fills in the links and, when it
 * can tell who is looking, what they have already done.
 */
export default async function GoPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const t = c.go;

  const today = sydneyToday().toISOString().slice(0, 10);
  const focus = focusSession();
  const session = focus.date;
  const phase = goPhase(focus, today);

  // Who is looking, if we can tell. Both reads are best-effort: a database
  // hiccup must not take down the one page everybody is sent to, so a failure
  // is treated as "anonymous".
  const store = await cookies();
  const orderId = readOrderToken(store.get(orderCookieName(session))?.value);

  const rememberedId = readRememberToken(store.get(REMEMBER_COOKIE)?.value);

  const [order, member, questions, counts, mine] = await Promise.all([
    orderId ? getOrder(orderId, session).catch(() => null) : null,
    currentMemberId()
      .then((id) => (id ? getMemberById(id) : null))
      .catch(() => null),
    // Best-effort like the two above: no shortlist is the same as an empty one.
    getSessionQuestions(session).catch(() => []),
    // Whether this session is already full, so signing up says "waitlist".
    signupCountsBySession().catch(() => new Map<string, number>()),
    // "This phone remembers you" (the vt_my cookie), best-effort like the rest.
    rememberedId ? getMySignup(rememberedId).catch(() => null) : null,
  ]);

  // Down for this session, booked or waitlisted — either way, not someone to
  // ask to sign up again (a second signup is how people ended up down for two
  // Thursdays, 2026-09-28). From the remembered signup when there is one.
  const inFocus = mine
    ? mine.sessions.includes(session) || mine.waitlist.some((entry) => entry.session === session)
    : null;
  const upcomingMine = mine
    ? [
        ...mine.sessions.map((date) => ({ date, waitlisted: false })),
        ...mine.waitlist.map((entry) => ({ date: entry.session, waitlisted: true })),
      ]
        .filter((entry) => entry.date >= today)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
    : [];
  const full = (counts.get(session) ?? 0) >= SESSION_CAP;

  // The check-in link only on the morning itself (James 2026-09-28). Keyed on
  // the date rather than the phase: at noon the page turns to feedback, and
  // anyone who forgot to tap still gets the link until it closes.
  const checkinOpen = checkinLinkOpen(session === today, sydneyHour());

  const items = goItems(phase, {
    // Either source saying "down for it" is enough; only when neither knows is
    // it null. `??` would let a remembered "no" override a card's "yes" when
    // the two are different rows of one person (2026-09-28 review).
    signedUp:
      inFocus === true || member?.sessions.includes(session)
        ? true
        : inFocus === false || member
          ? false
          : null,
    hasOrder: Boolean(order),
    hasCard: Boolean(member),
    checkinOpen,
  });

  const orderHref = withLang(`/order?s=${session}&k=${orderCode(session)}`, lang);

  const links: Record<GoItem, { title: string; body: string; href: string | null }> = {
    signup: { ...(full ? t.items.signupFull : t.items.signup), href: `/${langSuffix(lang)}#signup` },
    order: { ...t.items.order, href: orderHref },
    myOrder: {
      title: t.items.myOrder.title,
      body: order ? `${order.name} · ${order.label} · ${formatPrice(order.cents)}` : t.items.myOrder.body,
      href: orderHref,
    },
    mySignup: {
      title: t.items.mySignup.title,
      // Remembered: their actual Thursdays, e.g. "1 Oct · booked; 8 Oct · waitlist".
      body:
        mine && upcomingMine.length > 0
          ? upcomingMine
              .map((entry) => `${formatSession(entry.date, lang)} · ${entry.waitlisted ? c.signup.successTagWaitlist : c.signup.successTagBooked}`)
              .join("；")
          : t.items.mySignup.body,
      href: `/my${langSuffix(lang)}`,
    },
    card: member ? { ...t.items.cardEdit, href: `/me${langSuffix(lang)}` } : { ...t.items.card, href: `/claim${langSuffix(lang)}` },
    members: { ...t.items.members, href: `/members${langSuffix(lang)}` },
    wharf: { ...t.items.wharf, href: `/wharf${langSuffix(lang)}` },
    // A link only 10:00–13:00 on the day (`checkinLinkOpen`); otherwise a line
    // saying the code is on the table.
    checkin: checkinOpen
      ? { ...t.items.checkinOpen, href: withLang(`/checkin?s=${session}&k=${checkinCode(session)}`, lang) }
      : { ...t.items.checkin, href: null },
    // One link either way: /badge sends anyone without a card to /claim.
    badge: { ...(member ? t.items.badge : t.items.badgeNew), href: `/badge${langSuffix(lang)}` },
    feedback: { ...t.items.feedback, href: withLang(`/feedback?s=${session}&k=${feedbackCode(session)}`, lang) },
    chat: { ...t.items.chat, href: CHAT_URL },
    session: { ...t.items.session, href: `/sessions/${session}${langSuffix(lang)}` },
    nextSignup: { ...t.items.nextSignup, href: `/${langSuffix(lang)}#signup` },
  };

  const title = phase === "before" ? t.titleBefore : phase === "day" ? t.titleDay : t.titleAfter;

  // Where, read from the home page's venue card, so a venue change is one edit
  // and this page — which the group is told is where the address lives — can
  // never disagree with it. Found by its map link, not by position.
  const venue = c.hero.facts.find((fact) => fact.href?.includes("maps.google"));
  const shownDate = phase === "after" ? nextThursdays(1)[0] : session;

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/go" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "640px" }}>
            <div className="stack-3">
              <span className="eyebrow">
                {t.eyebrow} · {formatSession(session, lang)}
              </span>
              <h1>{title}</h1>
              {phase !== "after" && <p className="body-lg">{t.when}</p>}
              {phase === "after" && (
                <p className="body-lg">
                  {formatSession(shownDate, lang)} · {t.when}
                </p>
              )}
              {phase !== "after" && venue && (
                <p className="body-lg">
                  {venue.value}
                  {venue.href && venue.linkLabel && (
                    <>
                      {" · "}
                      <a className="hl" href={venue.href} target="_blank" rel="noopener noreferrer">
                        {venue.linkLabel}
                      </a>
                    </>
                  )}
                </p>
              )}
              {phase !== "after" && member?.sessions.includes(session) && (
                <p className="body-sm" style={{ color: "var(--accent)" }}>
                  {t.signedUp}
                </p>
              )}
            </div>

            <ol className="stack-3" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((key) => {
                const item = links[key];
                const inner = (
                  <>
                    <strong className="h3" style={{ display: "block" }}>
                      {item.title}
                      {item.href && " →"}
                    </strong>
                    <span className="body-sm" style={{ color: "var(--fg3)" }}>
                      {item.body}
                    </span>
                  </>
                );

                return (
                  <li key={key}>
                    {item.href?.startsWith("http") ? (
                      // Off-site (the booking page): a new tab, so /go stays open behind it.
                      <a
                        className="card stack-2"
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", textDecoration: "none" }}
                      >
                        {inner}
                      </a>
                    ) : item.href ? (
                      <Link className="card stack-2" href={item.href} style={{ display: "block", textDecoration: "none" }}>
                        {inner}
                      </Link>
                    ) : (
                      <div className="card stack-2">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* This week's Q&A shortlist, when the organiser has entered one. */}
            {questions.length > 0 && questionsMode(phase, checkinOpen) === "candidates" && (
              <section className="card stack-3" aria-labelledby="go-questions">
                <h2 className="h3" id="go-questions" style={{ margin: 0 }}>
                  {t.questionsCandidates}
                </h2>
                <ol className="stack-2" style={{ margin: 0, paddingLeft: "1.25em" }}>
                  {questions.map((question, index) => (
                    <li key={index}>{question.text}</li>
                  ))}
                </ol>
                <p className="body-sm" style={{ color: "var(--fg3)", margin: 0 }}>
                  {t.questionsVote}
                </p>
              </section>
            )}

            {questions.length > 0 && questionsMode(phase, checkinOpen) === "today" && (
              <section className="card stack-3" aria-labelledby="go-questions" style={{ borderColor: "var(--accent)" }}>
                <h2 className="h3" id="go-questions" style={{ margin: 0 }}>
                  {/* No vote marked yet: still the candidates, not "today we talk about". */}
                  {questions.some((q) => q.chosen) ? t.questionsToday : t.questionsCandidates}
                </h2>
                <ol className="stack-3" style={{ margin: 0, paddingLeft: "1.25em" }}>
                  {(questions.some((q) => q.chosen) ? questions.filter((q) => q.chosen) : questions).map(
                    (question, index) => (
                      <li key={index} className="body-lg" style={{ fontWeight: 600 }}>
                        {question.text}
                      </li>
                    ),
                  )}
                </ol>
                {questions.some((q) => q.chosen) && questions.some((q) => !q.chosen) && (
                  <div className="stack-2">
                    <p className="body-sm" style={{ color: "var(--fg3)", margin: 0 }}>
                      {t.questionsOthers}
                    </p>
                    <ul className="body-sm" style={{ margin: 0, paddingLeft: "1.25em", color: "var(--fg3)" }}>
                      {questions
                        .filter((q) => !q.chosen)
                        .map((question, index) => (
                          <li key={index}>{question.text}</li>
                        ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              {t.keep}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
