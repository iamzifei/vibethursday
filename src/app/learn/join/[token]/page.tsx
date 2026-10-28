import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { findInvite } from "@/lib/learn-db";
import { inviteUsable, looksLikeInviteToken } from "@/lib/learn";
import { learnLang, LEARN_COPY } from "@/lib/learn-copy";
import { currentLearner } from "@/lib/learn-session";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string; err?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return { title: LEARN_COPY[learnLang((await searchParams).lang)].join.title, robots: { index: false } };
}

/**
 * Where an invite link lands (2026-10-28). Sign in first (inside WeChat that is
 * silent), then give a name and go straight in: no waiting for the organiser.
 * Someone already in, or turned away, just goes on to /learn.
 */
export default async function JoinPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const lang = learnLang(query.lang);
  const t = LEARN_COPY[lang].join;
  const langQuery = lang === "en" ? "?lang=en" : "";

  const invite = looksLikeInviteToken(token) ? await findInvite(token) : null;
  const usable = inviteUsable(invite);

  const learner = await currentLearner();
  if (learner && learner.status !== "pending") redirect(`/learn${langQuery}`);
  if (!learner && usable) {
    redirect(`/learn/login?next=${encodeURIComponent(`/learn/join/${token}`)}${lang === "en" ? "&lang=en" : ""}`);
  }

  return (
    <main id="main" className="shell section">
      <div className="card stack-6" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="stack-3">
          <span className="eyebrow">{LEARN_COPY[lang].eyebrow}</span>
          <h1 className="h2">{t.title}</h1>
          {usable && <p className="body-sm">{t.lead}</p>}
        </div>
        {!usable || !learner ? (
          <p className="alert alert--error">{t.gone}</p>
        ) : (
          <form className="stack-3" method="post" action="/api/learn/join">
            {query.err && <p className="alert alert--error">{t.failed}</p>}
            <input type="hidden" name="token" value={token} />
            {lang === "en" && <input type="hidden" name="lang" value="en" />}
            <label className="label" htmlFor="join-name">
              {t.name}
            </label>
            <input className="field" id="join-name" name="name" required maxLength={40} defaultValue={learner.name ?? ""} autoComplete="name" />
            <button className="btn btn--primary btn--block" type="submit">
              {t.submit}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
