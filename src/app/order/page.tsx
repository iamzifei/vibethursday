import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, LANG_PARAM, resolveLang, type Lang } from "@/lib/content";
import { getOrder, listOrders, type OrderRecord } from "@/lib/db";
import { formatPrice, priceRange, VENUE_MENU } from "@/lib/menu";
import {
  canOrder,
  findByName,
  isSessionDate,
  isSized,
  orderCookieName,
  readOrderToken,
  verifyOrderCode,
} from "@/lib/order";
import { callerIp, checkRateLimit } from "@/lib/rate-limit";
import { formatSession, sydneyToday } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{
    lang?: string;
    /** Session date. */
    s?: string;
    /** Session code. */
    k?: string;
    /** A signed order id: this page as a receipt, without relying on a cookie. */
    mine?: string;
    /** "1": show the form even though this phone already has an order. */
    edit?: string;
    /** A name to look up, from the "find my order" box. */
    find?: string;
    /** What went wrong on the last post. */
    err?: string;
    /** What was typed, handed back after an error so it does not have to be typed again. */
    n?: string;
    i?: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).order;
  // Same reasoning as /checkin and /feedback: the code in the URL is the point.
  return { title: c.meta.title, robots: { index: false } };
}

/** This page's URL for one session, with extra parameters. */
function orderHref(session: string, code: string, lang: Lang, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ s: session, k: code, ...extra });
  const param = LANG_PARAM[lang];
  if (param) params.set("lang", param);
  return `/order?${params.toString()}`;
}

/** Name, drink and price, big enough to hold up at the counter. */
function OrderCard({ order, title, hint }: { order: OrderRecord; title: string; hint: string }) {
  return (
    <div className="card stack-3" style={{ borderColor: "var(--accent)" }}>
      <span className="eyebrow">{title}</span>
      <p className="h2" style={{ margin: 0 }}>
        {order.name}
      </p>
      <p className="h3" style={{ margin: 0 }}>
        {order.label} · {formatPrice(order.cents)}
      </p>
      {order.note && <p className="body-lg">{order.note}</p>}
      <p className="body-sm" style={{ color: "var(--fg3)" }}>
        {hint}
      </p>
    </div>
  );
}

/**
 * Ordering a drink ahead of a session.
 *
 * Plain HTML and a form post, like `/checkin` and `/feedback`: the link is
 * opened from the group chat, in whatever browser WeChat uses, and nothing
 * here may need script to work.
 *
 * Three ways back to "what did I order", each covering for the one before:
 * a cookie on this phone; the `mine=` link, which is the receipt page itself
 * and survives a lost cookie; and looking up by name, for a different phone.
 */
export default async function OrderPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);
  const t = c.order;

  const session = params.s ?? "";
  const code = params.k ?? "";

  const shell = (children: ReactNode) => (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/order" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "640px" }}>{children}</div>
        </section>
      </main>
      <SiteFooter lang={lang} copy={c} />
    </div>
  );

  if (!session && !code) {
    return shell(
      <div className="stack-4">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.noCodeTitle}</h1>
        <p className="body-lg">{t.noCodeBody}</p>
      </div>,
    );
  }

  if (!isSessionDate(session) || !verifyOrderCode(session, code)) {
    return shell(
      <div className="stack-4">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.closedTitle}</h1>
        <p className="body-lg">{t.closedBody}</p>
      </div>,
    );
  }

  const today = sydneyToday().toISOString().slice(0, 10);
  const open = canOrder(session, today);

  // The link first, then the cookie: somebody opening their own receipt link
  // on a phone that holds a different order should see the one in the link.
  const store = await cookies();
  const mineId = readOrderToken(params.mine) ?? readOrderToken(store.get(orderCookieName(session))?.value);
  const mine = mineId ? await getOrder(mineId, session) : null;

  // ── Find my order ────────────────────────────────────────────────
  // Rate-limited per address: it reads other people's rows, one exact name
  // at a time, and nobody at a counter needs more than a handful of tries.
  let found: OrderRecord[] | null = null;
  let findLimited = false;
  if (params.find !== undefined) {
    const requestHeaders = await headers();
    const ip = callerIp((name) => requestHeaders.get(name));

    if (checkRateLimit(`order-find:${ip}`, 30).allowed) {
      found = findByName(await listOrders(session), params.find);
    } else {
      findLimited = true;
    }
  }

  const heading = (
    <span className="eyebrow">
      {t.eyebrow} · {formatSession(session, lang)}
    </span>
  );

  const findBox = (
    <section className="stack-3">
      <h2 className="h3">{t.findTitle}</h2>
      <form method="get" action="/order" className="stack-3">
        <input type="hidden" name="s" value={session} />
        <input type="hidden" name="k" value={code} />
        {LANG_PARAM[lang] && <input type="hidden" name="lang" value={LANG_PARAM[lang]} />}
        <label className="label" htmlFor="order-find">
          {t.findLabel}
        </label>
        <input className="field" id="order-find" name="find" maxLength={100} defaultValue={params.find ?? ""} />
        <button className="btn btn--secondary" type="submit">
          {t.findSubmit}
        </button>
      </form>
      {findLimited && <p className="alert alert--error">{t.rateLimited}</p>}
      {found && found.length === 0 && <p className="body-sm">{t.findNone}</p>}
      {found && found.length > 0 && (
        <div className="stack-3">
          <p className="body-sm">{t.findResult}</p>
          {found.map((order) => (
            <OrderCard key={order.id} order={order} title={t.mineTitle} hint={t.mineHint} />
          ))}
        </div>
      )}
    </section>
  );

  // ── Closed: still show what this phone ordered, and the lookup ─────
  if (!open) {
    return shell(
      <>
        <div className="stack-4">
          {heading}
          <h1>{t.closedTitle}</h1>
          <p className="body-lg">{t.closedBody}</p>
        </div>
        {mine && <OrderCard order={mine} title={t.mineTitle} hint={t.mineHint} />}
      </>,
    );
  }

  // ── This phone has an order: show it, big ────────────────────────
  if (mine && params.edit !== "1") {
    return shell(
      <>
        <div className="stack-4">
          {heading}
          <h1>{t.doneTitle}</h1>
        </div>
        <OrderCard order={mine} title={t.mineTitle} hint={t.mineHint} />
        <div>
          <Link className="btn btn--secondary" href={orderHref(session, code, lang, { edit: "1" })}>
            {t.change}
          </Link>
        </div>
        <p className="body-sm" style={{ color: "var(--fg3)" }}>
          {t.payNote}
        </p>
        {findBox}
      </>,
    );
  }

  // ── The form ─────────────────────────────────────────────────────
  const error =
    params.err === "name" ? t.errName
    : params.err === "drink" ? t.errDrink
    : params.err === "rate" ? t.rateLimited
    : params.err === "failed" ? t.failed
    : null;

  const chosenItem = params.i ?? mine?.item_id ?? "";
  const chosenSize = mine?.size === "small" ? "small" : "large";

  return shell(
    <>
      <div className="stack-4">
        {heading}
        <h1>{t.title}</h1>
        <p className="body-lg">{t.lede}</p>
        <p className="body-sm" style={{ color: "var(--fg3)" }}>
          {t.venue.replace("{venue}", VENUE_MENU.venue)} · {t.payNote}
        </p>
      </div>

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      <form method="post" action="/api/order" className="stack-8">
        <input type="hidden" name="session" value={session} />
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="lang" value={lang} />

        <div>
          <label className="label" htmlFor="order-name">
            {t.nameLabel}
          </label>
          <input
            className="field"
            id="order-name"
            name="name"
            maxLength={60}
            required
            autoComplete="name"
            defaultValue={params.n ?? mine?.name ?? ""}
          />
          <p className="field-hint">{t.nameHint}</p>
        </div>

        <fieldset className="stack-4">
          <legend className="label">{t.drinkLabel}</legend>
          {VENUE_MENU.categories.map((category) => (
            <div className="stack-2" key={category.id}>
              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {lang === "en" ? category.en : category.zh}
              </p>
              <div className="choice-group">
                {VENUE_MENU.items
                  .filter((item) => item.category === category.id)
                  .map((item) => (
                    <label className="choice" key={item.id}>
                      <input
                        type="radio"
                        name="item"
                        value={item.id}
                        required
                        defaultChecked={item.id === chosenItem}
                      />
                      <span>
                        {item.name}
                        {lang !== "en" && ` ${item.zh}`} · {priceRange(item.price)}
                        {isSized(item) && " (S/L)"}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset className="stack-3">
          <legend className="label">{t.sizeLabel}</legend>
          <div className="choice-group choice-group--compact">
            <label className="choice">
              <input type="radio" name="size" value="small" defaultChecked={chosenSize === "small"} />
              <span>{t.sizeSmall}</span>
            </label>
            <label className="choice">
              <input type="radio" name="size" value="large" defaultChecked={chosenSize === "large"} />
              <span>{t.sizeLarge}</span>
            </label>
          </div>
          <p className="field-hint">{t.sizeHint}</p>
        </fieldset>

        <div>
          <label className="label" htmlFor="order-note">
            {t.noteLabel}
          </label>
          <input
            className="field"
            id="order-note"
            name="note"
            maxLength={80}
            placeholder={t.notePlaceholder}
            defaultValue={mine?.note ?? ""}
          />
        </div>

        <div>
          <label className="label" htmlFor="order-wechat">
            {t.wechatLabel}
          </label>
          <input
            className="field"
            id="order-wechat"
            name="wechat"
            maxLength={100}
            autoComplete="off"
            defaultValue={mine?.wechat ?? ""}
          />
          <p className="field-hint">{t.wechatHint}</p>
        </div>

        <button className="btn btn--primary btn--block" type="submit">
          {mine ? t.submitChange : t.submit}
        </button>
      </form>

      {findBox}
    </>,
  );
}
