import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, LANG_PARAM, resolveLang, type Lang } from "@/lib/content";
import { getMemberById, getOrder } from "@/lib/db";
import { feedbackCode } from "@/lib/feedback";
import { goItems, goPhase, type GoItem } from "@/lib/go";
import { currentMemberId } from "@/lib/member-auth";
import { formatPrice } from "@/lib/menu";
import { orderCode, orderCookieName, readOrderToken } from "@/lib/order";
import { focusSession, formatSession, nextThursdays, sydneyToday } from "@/lib/sessions";

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

  const [order, member] = await Promise.all([
    orderId ? getOrder(orderId, session).catch(() => null) : null,
    currentMemberId()
      .then((id) => (id ? getMemberById(id) : null))
      .catch(() => null),
  ]);

  const items = goItems(phase, {
    signedUp: member ? member.sessions.includes(session) : null,
    hasOrder: Boolean(order),
    hasCard: Boolean(member),
  });

  const orderHref = withLang(`/order?s=${session}&k=${orderCode(session)}`, lang);

  const links: Record<GoItem, { title: string; body: string; href: string | null }> = {
    signup: { ...t.items.signup, href: `/${langSuffix(lang)}#signup` },
    order: { ...t.items.order, href: orderHref },
    myOrder: {
      title: t.items.myOrder.title,
      body: order ? `${order.name} · ${order.label} · ${formatPrice(order.cents)}` : t.items.myOrder.body,
      href: orderHref,
    },
    card: member ? { ...t.items.cardEdit, href: `/me${langSuffix(lang)}` } : { ...t.items.card, href: `/claim${langSuffix(lang)}` },
    members: { ...t.items.members, href: `/members${langSuffix(lang)}` },
    wharf: { ...t.items.wharf, href: `/wharf${langSuffix(lang)}` },
    // ★ No link, ever: the code is on the table so that a check-in means "was in the room".
    checkin: { ...t.items.checkin, href: null },
    badge: { ...t.items.badge, href: `/badge${langSuffix(lang)}` },
    feedback: { ...t.items.feedback, href: withLang(`/feedback?s=${session}&k=${feedbackCode(session)}`, lang) },
    session: { ...t.items.session, href: `/sessions/${session}${langSuffix(lang)}` },
    nextSignup: { ...t.items.nextSignup, href: `/${langSuffix(lang)}#signup` },
  };

  const title = phase === "before" ? t.titleBefore : phase === "day" ? t.titleDay : t.titleAfter;
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
                    {item.href ? (
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
