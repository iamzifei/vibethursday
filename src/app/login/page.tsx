import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WechatQrLogin } from "@/components/WechatQrLogin";
import { WeChatMark } from "@/components/WeChatMark";
import { getCopy, resolveLang } from "@/lib/content";
import { findSignupIdByOpenid, getSignupProfile, qrLoginPin, qrLoginStatus } from "@/lib/db";
import { readRememberToken, REMEMBER_COOKIE } from "@/lib/my-signup";
import { langHref } from "@/lib/nav";
import { looksLikeQrToken, qrPinChoices, readOpenidToken, wechatConfigured } from "@/lib/wechat-auth";
import { isWeChatBrowser, safeNext, WX_OPENID_COOKIE } from "@/lib/wechat-gate";

// Every answer depends on this browser's cookies.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ lang?: string; next?: string; qr?: string; err?: string; h?: string; ok?: string; done?: string; wx?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).login;
  return { title: c.meta.title, robots: { index: false } };
}

/**
 * Log in with WeChat (2026-10-05), every case on one page:
 *
 * - On a computer: a QR code (`WechatQrLogin`). Scanning it opens this page on
 *   the phone with `?qr=`.
 * - In WeChat with `?qr=`: "log in on a computer as X?" and one button — or,
 *   the first time, the name-and-WeChat-ID form that links this WeChat.
 * - In WeChat without: who it recognised, or the same form.
 * - Not in WeChat, with `?qr=`: "scan this with WeChat".
 *
 * Inside WeChat the proxy has already been through the service account's
 * silent login before this renders, so the openid cookie is normally there;
 * when it is not (a failed trip), a button sends them through it again.
 */
export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);
  const t = c.login;
  // Never back to /login itself: the "already recognised → go to next" jump
  // below would then send this page to itself forever.
  const wanted = safeNext(params.next);
  const next = wanted === "/login" || wanted.startsWith("/login?") || wanted.startsWith("/login#") ? "/" : wanted;
  const qr = looksLikeQrToken(params.qr) ? params.qr : null;

  const store = await cookies();
  const inWeChat = isWeChatBrowser((await headers()).get("user-agent"));
  const openid = readOpenidToken(store.get(WX_OPENID_COOKIE)?.value);
  const rememberedId = readRememberToken(store.get(REMEMBER_COOKIE)?.value);

  // Whose signup: in WeChat, the one this WeChat is tied to; elsewhere, the
  // one this browser remembers. A failed read is "nobody", never an error page.
  let name: string | null = null;
  let signedIn = false;
  // The signup this browser remembers, when this WeChat is not tied to any
  // yet: offered as a one-tap "link to X?" instead of retyping a name and
  // WeChat ID (James 2026-10-05). Never tied silently — on a shared phone the
  // remembered signup can be a friend's, so the person confirms it is them.
  let rememberedName: string | null = null;
  try {
    const openidId = openid ? await findSignupIdByOpenid(openid) : null;
    const id = inWeChat && openid ? openidId : rememberedId;
    name = id ? (await getSignupProfile(id))?.name ?? null : null;
    // Logged in = this browser's remember cookie names that same signup. In
    // WeChat the tie can exist without it (linked after the WeChat login).
    signedIn = Boolean(id && rememberedId === id);
    if (inWeChat && openid && !openidId && rememberedId) {
      rememberedName = (await getSignupProfile(rememberedId))?.name ?? null;
    }
  } catch (error) {
    console.error("[login] could not read who this is", error);
  }

  // In WeChat without its login yet — usually someone this browser already
  // remembers, whom the proxy therefore never sent round — go and get it
  // first, then come back here (`wx=1` stops a second attempt if it fails).
  const startHref = `/api/wechat/start?next=${encodeURIComponent(`/login?${new URLSearchParams({ ...(qr ? { qr } : {}), ...(next !== "/" ? { next } : {}), ...(params.lang ? { lang: params.lang } : {}), wx: "1" }).toString()}`)}`;
  if (wechatConfigured() && inWeChat && !openid && !params.wx) redirect(startHref);

  // Already recognised and not here to confirm a computer: nothing to do on
  // this page — straight back to where they were going (2026-10-05). The form
  // there greets them by name and has its own "not me".
  // Recognised by WeChat but not yet logged in on this browser: log it in on
  // the way back, or the form would not know them and the button would seem
  // to do nothing (2026-10-05, measured on a phone).
  if (name && !qr && wechatConfigured()) {
    redirect(signedIn ? langHref(next, lang) : `/api/wechat/session?next=${encodeURIComponent(langHref(next, lang))}`);
  }

  const qrState = qr ? await qrLoginStatus(qr).catch(() => "missing" as const) : null;
  const pin = qr && qrState === "pending" ? await qrLoginPin(qr).catch(() => null) : null;

  // Only the known messages, and the name hint cut to two characters: these
  // come from the address bar, and a crafted link must not be able to put its
  // own words above a login button (review).
  const errKey = params.err && Object.hasOwn(t.errors, params.err) ? (params.err as keyof typeof t.errors) : null;
  const error = errKey ? t.errors[errKey].replace("{h}", (params.h ?? "").slice(0, 2)) : null;

  const hidden = (
    <>
      <input type="hidden" name="lang" value={params.lang ?? ""} />
      {qr && <input type="hidden" name="qr" value={qr} />}
      <input type="hidden" name="next" value={next} />
    </>
  );

  // The first-time form: name and WeChat ID, the same door as /my.
  const linkForm = (
    <form method="post" action="/api/wechat/link" className="stack-4">
      {hidden}
      <div className="stack-2">
        <h2 className="h3">{t.linkedBeforeTitle}</h2>
        <p className="body">{t.linkLede}</p>
      </div>
      <div className="grid-auto">
        <div>
          <label className="label" htmlFor="login-name">{t.name}</label>
          <input className="field" id="login-name" name="name" required autoComplete="name" maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="login-wechat">{t.wechat}</label>
          <input className="field" id="login-wechat" name="wechat" required autoCapitalize="off" autoCorrect="off" maxLength={60} />
        </div>
      </div>
      <div>
        <button className="btn btn--primary" type="submit">{t.linkSubmit}</button>
      </div>
    </form>
  );

  // The other half of the choice, for a WeChat nobody has linked yet: no need
  // to log in to anything — signing up from this browser links it.
  const firstTime = (
    <div className="card stack-3">
      <h2 className="h3">{t.firstTimeTitle}</h2>
      <p className="body" style={{ margin: 0 }}>{t.firstTimeBody}</p>
      <div>
        <a className="btn btn--primary" href={langHref(next === "/" ? "/#signup" : next, lang)}>{t.firstTimeCta}</a>
      </div>
    </div>
  );

  // "Not me": /my's forget, which also unties this WeChat from that signup.
  const notMe = (
    <form method="post" action="/api/my" style={{ margin: 0 }}>
      <input type="hidden" name="action" value="forget" />
      <input type="hidden" name="lang" value={params.lang ?? ""} />
      <button type="submit" className="link-button">{t.notMe}</button>
    </form>
  );

  let body: React.ReactNode;

  if (!wechatConfigured()) {
    // Switched off: nothing here works, so point at the way that does.
    body = (
      <p className="body-lg">
        {t.orMy}<Link href={langHref("/my", lang)}>{t.orMyLink}</Link>
      </p>
    );
  } else if (qr && params.done) {
    body = (
      <div className="card card--accent stack-2" role="status">
        <h2 className="h3">{t.qrDoneTitle}</h2>
        <p className="body">{t.qrDoneBody}</p>
      </div>
    );
  } else if (qr && !inWeChat) {
    body = (
      <div className="stack-2">
        <h2 className="h3">{t.needWechatTitle}</h2>
        <p className="body">{t.needWechatBody}</p>
      </div>
    );
  } else if (qr && qrState !== "pending") {
    body = <p className="body-lg" role="alert">{t.errors.expired}</p>;
  } else if (inWeChat && !openid) {
    // The silent login did not happen or did not stick: one button to retry.
    body = (
      <div className="stack-4">
        <p className="body-lg">{t.startLede}</p>
        <div>
          <a className="btn btn--primary" href={startHref}>{t.startCta}</a>
        </div>
      </div>
    );
  } else if (qr) {
    // A phone that scanned a computer's code. Tied already, or remembered by
    // this browser (then picking the number also ties this WeChat).
    const who = name ?? rememberedName;
    body = who ? (
      <form method="post" action="/api/wechat/link" className="card stack-4">
        {hidden}
        {!name && <input type="hidden" name="useRemembered" value="1" />}
        <h2 className="h3">{t.qrConfirmTitle}</h2>
        <p className="body-lg" style={{ margin: 0 }}><strong>{t.qrConfirmAs.replace("{name}", who)}</strong></p>
        {/* Three numbers, one of them on the computer's screen. Each is its own
            submit button, so the pick is the confirmation — and the warning
            sits right here, where the decision is made. */}
        <p className="body" style={{ margin: 0 }}>{t.qrPinPrompt}</p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
          {pin &&
            qrPinChoices(qr, pin).map((choice) => (
              <button key={choice} className="btn btn--secondary" type="submit" name="pin" value={choice} style={{ minWidth: "4.5rem", fontSize: "1.4rem" }}>
                {choice}
              </button>
            ))}
        </div>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>{t.qrConfirmBody}</p>
        {notMe}
      </form>
    ) : (
      // Linking first, nothing to confirm yet — the warning belongs with the
      // numbers, one step on, not above a name form (James 2026-10-05: the
      // first screen read as a threat).
      <div className="stack-6">
        {linkForm}
        <p className="body-sm" style={{ color: "var(--fg3)" }}>{t.firstTimeDesktop}</p>
      </div>
    );
  } else if (name) {
    body = (
      <div className="card card--accent stack-4" role="status">
        <h2 className="h3">{t.recognizedTitle}</h2>
        <p className="body-lg" style={{ margin: 0 }}>{t.recognizedAs.replace("{name}", name)}</p>
        {params.ok && <p className="body">{t.linkedOk}</p>}
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
          <a className="btn btn--primary" href={langHref(next, lang)}>{t.continue}</a>
          {notMe}
        </div>
      </div>
    );
  } else if (inWeChat && rememberedName) {
    // One tap instead of retyping: this browser already knows who this is.
    body = (
      <form method="post" action="/api/wechat/link" className="card card--accent stack-4">
        {hidden}
        <input type="hidden" name="useRemembered" value="1" />
        <h2 className="h3">{t.bindTitle}</h2>
        <p className="body" style={{ margin: 0 }}>{t.bindBody.replace("{name}", rememberedName)}</p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn--wechat" type="submit">
            <WeChatMark />
            {t.bindCta.replace("{name}", rememberedName)}
          </button>
          {notMe}
        </div>
      </form>
    );
  } else if (inWeChat) {
    body = (
      <div className="stack-8">
        {firstTime}
        {linkForm}
      </div>
    );
  } else {
    body = (
      <div className="stack-4">
        <p className="body-lg">{t.desktopLede}</p>
        <WechatQrLogin copy={t} next={langHref(next, lang)} />
        <p className="body-sm">
          {t.firstTimeDesktop} <a href={langHref(next === "/" ? "/#signup" : next, lang)}>{t.firstTimeCta} →</a>
        </p>
        <p className="body-sm">
          {t.orMy}<Link href={langHref("/my", lang)}>{t.orMyLink}</Link>
        </p>
      </div>
    );
  }

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/login" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "640px" }}>
            <div className="stack-4">
              <span className="eyebrow">{t.eyebrow}</span>
              <h1>{t.title}</h1>
            </div>
            {error && <p className="body" role="alert" style={{ color: "var(--warning)" }}>{error}</p>}
            {body}
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
