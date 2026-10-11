import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/ClaimForm";
import { langSuffix } from "@/components/MemberCard";
import { SiteHeader } from "@/components/SiteHeader";
import { WeChatMark } from "@/components/WeChatMark";
import { getCopy, LANG_PARAM, resolveLang } from "@/lib/content";
import { wechatLoginHref } from "@/lib/login-link";
import { currentMemberId } from "@/lib/member-auth";
import { currentAccount } from "@/lib/account";

type PageProps = {
  /** `in=1`: sent here by /badge right after checking in, with no card yet. */
  searchParams: Promise<{ lang?: string; in?: string; from?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).claim;

  // Nothing here is worth indexing, and a claim form in search results is a
  // slightly odd first impression of the community.
  return { title: c.meta.title, description: c.meta.description, robots: { index: false } };
}

export default async function ClaimPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);

  // Recognised any way at all (card, this phone, WeChat): /me opens or makes
  // their card, so there is nothing to claim.
  // Not when /me just sent them here because it could not open a card: then
  // the form is the way forward, and redirecting back would loop.
  if (params.from !== "me" && ((await currentMemberId()) || (await currentAccount()))) redirect(`/me${langSuffix(lang)}`);

  const loginHref = wechatLoginHref("/me", LANG_PARAM[lang]);

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/claim" />

      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "640px" }}>
            <div className="stack-4">
              {params.in === "1" && (
                <p className="body-lg" style={{ color: "var(--accent)", margin: 0 }}>
                  {c.claim.checkedIn}
                </p>
              )}
              <span className="eyebrow">{c.claim.eyebrow}</span>
              <h1>{c.claim.title}</h1>
              <p className="body-lg">{c.claim.lede}</p>
            </div>

            {/* WeChat first (2026-10-11): many members are not at home with
                forms, and a WeChat login links this WeChat once and for all —
                after it, opening the site in WeChat is enough. The form stays
                for anyone without WeChat login. */}
            {loginHref && (
              <div className="stack-3">
                <a className="btn btn--wechat btn--block" href={loginHref}>
                  <WeChatMark />
                  {c.login.entry}
                </a>
                <p className="or-divider" style={{ margin: 0 }}>{c.login.orFill}</p>
              </div>
            )}

            <ClaimForm copy={c.claim} nextHref={`/me${langSuffix(lang)}`} />

            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              {c.claim.noSignupLead}{" "}
              <Link href={`/${langSuffix(lang)}#signup`}>{c.claim.noSignupCta}</Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
