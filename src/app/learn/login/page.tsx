import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { currentAccount } from "@/lib/account";
import { getSignupProfile } from "@/lib/db";
import { learnLang, LEARN_COPY } from "@/lib/learn-copy";
import { currentLearner } from "@/lib/learn-session";
import { mailConfigured } from "@/lib/mail";
import { requestOrigin } from "@/lib/request-origin";
import { wechatConfigured } from "@/lib/wechat-auth";
import { isWeChatBrowser, safeNext, WX_TRIED_COOKIE } from "@/lib/wechat-gate";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ lang?: string; next?: string; step?: string; err?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return { title: LEARN_COPY[learnLang((await searchParams).lang)].login.title, robots: { index: false } };
}

/**
 * Signing in to /learn.
 *
 * - Inside WeChat: one button through the service account's login (or straight
 *   there, the first time). Nothing to type.
 * - Anywhere else: a QR code of /learn to open it inside WeChat, and an email
 *   code for people without WeChat — most of whom are in Australia.
 */
export default async function LearnLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = learnLang(params.lang);
  const t = LEARN_COPY[lang].login;
  const langQuery = lang === "en" ? "lang=en" : "";
  const wanted = safeNext(params.next);
  const next = wanted.startsWith("/learn") && !wanted.startsWith("/learn/login") ? wanted : "/learn";

  if (await currentLearner()) redirect(next);

  const userAgent = (await headers()).get("user-agent");
  const inWeChat = isWeChatBrowser(userAgent);
  const wechatOn = wechatConfigured();
  const startHref = `/api/wechat/start?next=${encodeURIComponent(next)}`;

  // First visit inside WeChat: go straight through WeChat's silent login.
  // `tried` (set by the start route) stops this from ever looping.
  if (inWeChat && wechatOn && !(await cookies()).has(WX_TRIED_COOKIE)) redirect(startHref);

  const origin = await requestOrigin();
  const qr =
    !inWeChat && wechatOn
      ? await QRCode.toDataURL(`${origin}${next}${langQuery ? (next.includes("?") ? "&" : "?") + langQuery : ""}`, {
          width: 360,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0a0b0d", light: "#ffffff" },
        })
      : null;

  // Someone the main site remembers only by name and contact (a weak proof)
  // is not let into lessons on that alone; say so, by the name they gave.
  const account = await currentAccount();
  const knownName = account ? ((await getSignupProfile(account.signupId).catch(() => null))?.name ?? null) : null;

  const emailOn = mailConfigured();
  const codeStep = params.step === "code";
  const error = params.err ? t.errors[params.err] : null;

  return (
    <main id="main" className="shell section">
      <div className="card stack-6" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="stack-3">
          <span className="eyebrow">{LEARN_COPY[lang].eyebrow}</span>
          <h1 className="h2">{t.title}</h1>
          <p className="body-sm">{t.lead}</p>
        </div>

        {error && <p className="alert alert--error">{error}</p>}
        {knownName && !error && <p className="alert alert--success">{t.knownAs(knownName)}</p>}

        {wechatOn && inWeChat && (
          <a className="btn btn--wechat btn--block" href={startHref}>
            {t.wechatInApp}
          </a>
        )}

        {qr && (
          <div className="stack-2" style={{ textAlign: "center" }}>
            <p className="body-sm">
              <strong>{t.wechatScan}</strong>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL; next/image adds nothing here */}
            <img src={qr} alt="" width={180} height={180} style={{ margin: "0 auto" }} />
            <p className="field-hint">{t.wechatScanHint}</p>
          </div>
        )}

        {emailOn && (
          <div className="stack-3">
            {wechatOn && <p className="eyebrow">{t.orEmail}</p>}
            {codeStep ? (
              <form className="stack-3" method="post" action="/api/learn/email">
                <input type="hidden" name="step" value="verify" />
                <input type="hidden" name="next" value={next} />
                {lang === "en" && <input type="hidden" name="lang" value="en" />}
                <label className="label" htmlFor="learn-code">
                  {t.code}
                </label>
                <input
                  className="field"
                  id="learn-code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  required
                  autoFocus
                />
                <p className="field-hint">{t.codeHint}</p>
                <button className="btn btn--primary btn--block" type="submit">
                  {t.verify}
                </button>
                <a className="body-sm" href={`/learn/login${langQuery ? `?${langQuery}` : ""}`}>
                  {t.resend}
                </a>
              </form>
            ) : (
              <form className="stack-3" method="post" action="/api/learn/email">
                <input type="hidden" name="step" value="send" />
                <input type="hidden" name="next" value={next} />
                {lang === "en" && <input type="hidden" name="lang" value="en" />}
                <label className="label" htmlFor="learn-email">
                  {t.email}
                </label>
                <input className="field" id="learn-email" name="email" type="email" autoComplete="email" maxLength={254} required />
                <button className={wechatOn ? "btn btn--secondary btn--block" : "btn btn--primary btn--block"} type="submit">
                  {t.send}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
