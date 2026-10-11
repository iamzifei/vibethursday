import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/ClaimForm";
import { langSuffix } from "@/components/MemberCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, resolveLang } from "@/lib/content";
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
