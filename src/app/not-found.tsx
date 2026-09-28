import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy } from "@/lib/content";

/**
 * Every 404 on the site.
 *
 * Until 2026-09-28 this was Next's default: white, English, one line — which
 * is what someone got in WeChat after scanning the QR code on an unpublished
 * member card. A not-found page cannot know the language it was asked in, so
 * it says the one likely reason in both and offers the three ways on.
 */
export default function NotFound() {
  const c = getCopy("zh");
  const t = c.notFound;

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang="zh" copy={c} path="/" />
      <main id="main">
        <section className="section">
          <div className="shell stack-6" style={{ maxWidth: "640px" }}>
            <span className="eyebrow">404</span>
            <h1>{t.title}</h1>
            <p className="body-lg">{t.body}</p>
            <p className="body" lang="en" style={{ color: "var(--fg2)" }}>
              {t.bodyEn}
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Link className="btn btn--primary" href="/">
                {t.home}
              </Link>
              <Link className="btn btn--secondary" href="/members">
                {t.members}
              </Link>
              <Link className="btn btn--secondary" href="/my">
                {t.my}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
