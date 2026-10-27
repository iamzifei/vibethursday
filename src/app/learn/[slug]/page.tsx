import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnPlayer } from "@/components/LearnPlayer";
import { getLessonBySlug, listComments, listLessonFiles, type LessonComment } from "@/lib/learn-db";
import { canAccessLessons, looksLikeLessonSlug } from "@/lib/learn";
import { learnLang, LEARN_COPY } from "@/lib/learn-copy";
import { currentLearner } from "@/lib/learn-session";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string; reply?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  // The lesson title is not put in the metadata: the page is for members only.
  return { title: LEARN_COPY[learnLang((await searchParams).lang)].title, robots: { index: false } };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** One lesson: the video, its handouts, and its comments. Approved learners only. */
export default async function LessonPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const lang = learnLang(query.lang);
  const t = LEARN_COPY[lang].lesson;
  const langQuery = lang === "en" ? "?lang=en" : "";

  const learner = await currentLearner();
  if (!learner) redirect(`/learn/login?next=${encodeURIComponent(`/learn/${looksLikeLessonSlug(slug) ? slug : ""}`)}${lang === "en" ? "&lang=en" : ""}`);
  if (!canAccessLessons(learner)) redirect(`/learn${langQuery}`);
  if (!looksLikeLessonSlug(slug)) notFound();

  const lesson = await getLessonBySlug(slug);
  if (!lesson?.published) notFound();

  const [files, comments] = await Promise.all([listLessonFiles(lesson.id), listComments(lesson.id, false)]);
  const roots = comments.filter((c) => !c.parentId);
  const replies = (id: string) => comments.filter((c) => c.parentId === id);
  const replyTo = query.reply && roots.some((c) => c.id === query.reply) ? query.reply : null;

  const who = (c: LessonComment) => (c.byAdmin ? t.host : c.name || t.someone);
  const when = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "en" ? "en-AU" : "zh-CN", { month: "short", day: "numeric" });

  const commentForm = (parent: string | null) => (
    <form className="stack-2" method="post" action="/api/learn/comment">
      <input type="hidden" name="lesson" value={lesson.slug} />
      {parent && <input type="hidden" name="parent" value={parent} />}
      {lang === "en" && <input type="hidden" name="lang" value="en" />}
      <label className="label" htmlFor={`comment-${parent ?? "new"}`}>
        {parent ? t.reply : t.write}
      </label>
      <textarea className="field" id={`comment-${parent ?? "new"}`} name="body" required maxLength={2000} />
      <button className="btn btn--primary" type="submit" style={{ alignSelf: "flex-start" }}>
        {t.post}
      </button>
    </form>
  );

  return (
    <main id="main" className="shell section stack-6" style={{ maxWidth: 900 }}>
      <Link className="body-sm" href={`/learn${langQuery}`}>
        {t.back}
      </Link>

      <h1 className="h2">{lesson.title}</h1>

      <LearnPlayer
        lesson={lesson.slug}
        watermark={learner.name || learner.email || `#${learner.id}`}
        messages={{ coming: t.videoComing, error: t.videoError }}
      />

      {lesson.summary && <p className="body-lg" style={{ whiteSpace: "pre-line" }}>{lesson.summary}</p>}

      <section className="stack-3" aria-labelledby="handouts">
        <h2 className="h3" id="handouts">
          {t.handouts}
        </h2>
        {files.length === 0 ? (
          <p className="body-sm">{t.noHandouts}</p>
        ) : (
          <ul className="stack-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {files.map((file) => (
              <li key={file.id}>
                {/* A plain link: the route answers with a fresh ten-minute download link. */}
                <a className="btn btn--secondary" href={`/api/learn/file?id=${file.id}`}>
                  ↓ {file.title} <span className="body-sm">({file.ext.toUpperCase()} · {formatBytes(file.bytes)})</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-4" id="comments" aria-labelledby="comments-title">
        <h2 className="h3" id="comments-title">
          {t.comments}
        </h2>
        {roots.length === 0 && <p className="body-sm">{t.noComments}</p>}
        {roots.map((comment) => (
          <article key={comment.id} className="card stack-2">
            <p className="body-sm">
              <strong>{who(comment)}</strong> · {when(comment.createdAt)}
            </p>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{comment.body}</p>
            {replies(comment.id).map((reply) => (
              <div key={reply.id} className="stack-1" style={{ borderLeft: "2px solid var(--border-default)", paddingLeft: "var(--space-4)" }}>
                <p className="body-sm">
                  <strong>{who(reply)}</strong> · {when(reply.createdAt)}
                </p>
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{reply.body}</p>
              </div>
            ))}
            {replyTo === comment.id ? (
              commentForm(comment.id)
            ) : (
              <Link className="body-sm" href={`/learn/${lesson.slug}?${lang === "en" ? "lang=en&" : ""}reply=${comment.id}#comments`}>
                {t.reply}
              </Link>
            )}
          </article>
        ))}
        {!replyTo && commentForm(null)}
      </section>
    </main>
  );
}
