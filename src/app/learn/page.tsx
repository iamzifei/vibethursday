import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listLessons } from "@/lib/learn-db";
import { canAccessLessons, formatDuration } from "@/lib/learn";
import { learnLang, LEARN_COPY, type LearnLang } from "@/lib/learn-copy";
import { currentLearner } from "@/lib/learn-session";
import type { Learner } from "@/lib/learn-db";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return { title: LEARN_COPY[learnLang((await searchParams).lang)].title, robots: { index: false } };
}

/**
 * The lesson list (2026-10-28). Approved learners see the lessons; a learner
 * still waiting sees a form to say who they are; nobody signed in is sent to
 * /learn/login.
 */
export default async function LearnPage({ searchParams }: PageProps) {
  const lang = learnLang((await searchParams).lang);
  const t = LEARN_COPY[lang];
  const langQuery = lang === "en" ? "?lang=en" : "";

  const learner = await currentLearner();
  if (!learner) redirect(`/learn/login${langQuery}`);
  if (!canAccessLessons(learner)) return <Waiting learner={learner} lang={lang} />;

  const lessons = await listLessons(false);

  return (
    <main id="main" className="shell section stack-6" style={{ maxWidth: 760 }}>
      <div className="stack-3">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1 className="h2">{t.title}</h1>
        <p className="body-sm">{t.list.lead}</p>
      </div>

      {lessons.length === 0 ? (
        <p className="card body-sm">{t.list.empty}</p>
      ) : (
        <ol className="stack-3" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <Link className="card stack-1" href={`/learn/${lesson.slug}${langQuery}`} style={{ display: "block", textDecoration: "none" }}>
                <span className="eyebrow">
                  {String(index + 1).padStart(2, "0")}
                  {formatDuration(lesson.durationS) ? ` · ${formatDuration(lesson.durationS)}` : ""}
                </span>
                <span className="h3" style={{ display: "block" }}>
                  {lesson.title}
                </span>
                {lesson.summary && <span className="body-sm" style={{ display: "block" }}>{lesson.summary}</span>}
              </Link>
            </li>
          ))}
        </ol>
      )}

      {/* Only an email sign-in can be undone here; WeChat recognises its own. */}
      {learner.email && (
        <form method="post" action="/api/learn/logout">
          <button className="btn btn--secondary" type="submit">
            {t.list.signOut}
          </button>
        </form>
      )}
    </main>
  );
}

function Waiting({ learner, lang }: { learner: Learner; lang: LearnLang }) {
  const t = LEARN_COPY[lang];
  if (learner.status === "revoked") {
    return (
      <main id="main" className="shell section">
        <div className="card stack-3" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1 className="h2">{t.revoked.title}</h1>
          <p className="body-sm">{t.revoked.lead}</p>
        </div>
      </main>
    );
  }

  const form = (
    <form className="stack-3" method="post" action="/api/learn/apply">
      {lang === "en" && <input type="hidden" name="lang" value="en" />}
      <label className="label" htmlFor="learn-name">
        {t.pending.name}
      </label>
      <input className="field" id="learn-name" name="name" required maxLength={40} defaultValue={learner.name ?? ""} autoComplete="name" />
      <label className="label" htmlFor="learn-note">
        {t.pending.note}
      </label>
      <input className="field" id="learn-note" name="note" maxLength={200} defaultValue={learner.note ?? ""} />
      <button className="btn btn--primary btn--block" type="submit">
        {t.pending.submit}
      </button>
    </form>
  );

  // Already said who they are: what happens next comes first, and the form
  // folds away. Before 2026-10-29 the same form came back looking untouched,
  // which read as "the button did nothing".
  if (learner.name) {
    return (
      <main id="main" className="shell section">
        <div className="card stack-6" style={{ maxWidth: 520, margin: "0 auto" }}>
          <div className="stack-3">
            <span className="eyebrow">{t.eyebrow}</span>
            <h1 className="h2">{t.pending.sentTitle}</h1>
            <p className="alert alert--success">
              {t.pending.sentAs}
              <strong>{learner.name}</strong>
            </p>
            <p className="body-sm">{t.pending.sentLead}</p>
          </div>
          <a className="btn btn--primary btn--block" href={`/learn${lang === "en" ? "?lang=en" : ""}`}>
            {t.pending.refresh}
          </a>
          <details className="disclosure">
            <summary>{t.pending.edit}</summary>
            <div className="disclosure__body">{form}</div>
          </details>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="shell section">
      <div className="card stack-6" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="stack-3">
          <span className="eyebrow">{t.eyebrow}</span>
          <h1 className="h2">{t.pending.title}</h1>
          <p className="body-sm">{t.pending.lead}</p>
        </div>
        {form}
      </div>
    </main>
  );
}
