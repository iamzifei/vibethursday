import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/ClaimForm";
import { langSuffix } from "@/components/MemberCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, resolveLang } from "@/lib/content";
import { currentMemberId } from "@/lib/member-auth";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).claim;

  // Nothing here is worth indexing, and a claim form in search results is a
  // slightly odd first impression of the community.
  return { title: c.meta.title, description: c.meta.description, robots: { index: false } };
}

export default async function ClaimPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);

  // Already claimed on this device: there is nothing to do here.
  if (await currentMemberId()) redirect(`/me${langSuffix(lang)}`);

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/claim" />

      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "640px" }}>
            <div className="stack-4">
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
