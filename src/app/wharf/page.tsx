import type { Metadata } from "next";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { DarlingHarbour } from "@/components/DarlingHarbour";
import { AnswerForm, AskBox, CloseForm, ComingButton, EditForm } from "@/components/WharfActions";
import { coachAvailable } from "@/lib/coach";
import { getCopy, resolveLang, type Copy, type Lang } from "@/lib/content";
import { listWharfQuestions, openQuestionCount, type WharfQuestion } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";
import { byNewest, canClaim, canEdit, statusOf, type Lane, type QuestionStatus } from "@/lib/questions";
import { gullMood } from "@/lib/wharf";
import { formatSession, nextThursdays } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).wharf;

  return {
    title: c.meta.title,
    description: c.meta.description,
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: c.meta.title }],
    },
  };
}

/**
 * The Wharf.
 *
 * Two lanes, because about two thirds of what people write in the sign-up
 * box is not a question — it is "I want to see what everyone is building".
 * Those are true things to want and they are exactly what the member wall
 * trades in; they are simply not answerable, and mixing them into a list of
 * answerable questions buries the answerable ones. ⚠️ **The rule sorts and
 * never hides**, for the reason set out in `classifyLane`: the two ways of
 * being wrong cost very different amounts.
 *
 * A question can be taken two ways — somebody says they will be at a named
 * Thursday for it, or somebody answers here. Both exist because a claim
 * assumes the two people end up in a room together, and that assumption only
 * holds for this week's questions. For one from three weeks ago it is usually
 * false, which is the hole this release exists to close.
 *
 * **Privacy, unchanged:** every question and every reply belongs to a
 * published member card. `listWharfQuestions` filters on `published_at IS NOT
 * NULL AND NOT hidden`, and a question cannot exist without a member row.
 *
 * **Anti-spam, and why there is none:** writing anything here needs the member
 * cookie, which is only issued at /claim, which only matches somebody who has
 * already signed up for a session. A stranger cannot reach the write path at
 * all. See `api/wharf/route.ts`.
 */
export default async function WharfPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const w = c.wharf;

  const memberId = await currentMemberId();

  const [questions, openCount] = await Promise.all([
    listWharfQuestions(),
    memberId ? openQuestionCount(memberId) : Promise.resolve(0),
  ]);

  const now = new Date();
  const upcoming = nextThursdays(4).map((value) => ({
    value,
    label: formatSession(value, lang),
  }));

  const rows = questions.map((question) => ({
    question,
    status: statusOf(
      {
        closed_at: question.closed_at,
        created_at: question.created_at,
        claims: question.replies.filter((reply) => reply.kind === "coming").length,
        answers: question.replies.filter((reply) => reply.kind === "answer").length,
      },
      now,
    ),
  }));

  const inLane = (which: Lane) =>
    byNewest(rows.filter((row) => row.question.lane === which).map((row) => row.question)).map(
      (question) => rows.find((row) => row.question.id === question.id)!,
    );

  const asking = inLane("question");
  const vague = inLane("vague");
  const chatting = inLane("chat");
  const live = asking.filter((row) => row.status === "open").length;

  // The bird reports the board it is standing on: how many nobody has taken.
  const mood = gullMood(live, asking.length);
  const say =
    mood === "waiting" ? w.say.waiting.replace("{n}", String(live)) : w.say[mood];

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/wharf" />

      <main id="main">
        <header className="wharf-hero">
          {/* Pyrmont Bridge, the tall ship's masts and the Anzac Bridge
              pylons — Darling Harbour, eighty metres from the room this page is
              about. Deliberately not the home page's Harbour Bridge: repeating
              it would make the two pages look like one, and it is the wrong
              harbour anyway. */}
          <DarlingHarbour />

          <div className="shell stack-4">
            <span className="eyebrow">{w.eyebrow}</span>
            <h1>{w.title}</h1>
            <p className="body-lg" style={{ maxWidth: "56ch" }}>
              {w.lede}
            </p>
            <p className="body-sm" style={{ maxWidth: "56ch", color: "var(--fg3)" }}>
              {w.place}
            </p>

            <div className="wharf-mascot">
              <picture>
                <source
                  type="image/avif"
                  srcSet="/wharf/gull-240.avif 240w, /wharf/gull-480.avif 480w"
                  sizes="180px"
                />
                <img
                  src="/wharf/gull-480.jpg"
                  srcSet="/wharf/gull-240.jpg 240w, /wharf/gull-480.jpg 480w"
                  sizes="180px"
                  alt={w.gullAlt}
                  width={480}
                  height={383}
                  decoding="async"
                />
              </picture>
              <p className="wharf-say">{say}</p>
            </div>
          </div>
        </header>

        <section className="section" style={{ paddingTop: "var(--space-8)" }}>
          <div className="shell stack-8">
            {/* Asking directly. Until now the only way a question could exist
                was the sign-up form, so anything that came up between two
                Thursdays had nowhere to go. */}
            <div className="stack-3">
              <span className="archive__label">{w.askCta}</span>
              {memberId ? (
                <AskBox sessions={upcoming} atLimit={openCount >= 1} coach={coachAvailable()} copy={w} />
              ) : (
                <p className="wharf-empty">
                  {w.signedOutNote} <Link href={`/claim${langSuffix(lang)}`}>{w.signInCta}</Link>
                </p>
              )}
            </div>

            <div className="stack-4">
              <div className="wharf-group">
                <span className="wharf-group__label wharf-group__label--now">
                  {w.laneQuestion} · {asking.length}
                </span>
                <span className="wharf-group__rule" />
              </div>

              {asking.length === 0 ? (
                <p className="wharf-empty">{w.emptyWeek}</p>
              ) : (
                asking.map(({ question, status }) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    status={status}
                    lang={lang}
                    copy={w}
                    sessions={upcoming}
                    signedIn={Boolean(memberId)}
                    mine={question.member_id === memberId}
                  />
                ))
              )}
            </div>

            {/* ★ Between the two. These are real questions from people who
                really want an answer — they just do not say enough for a
                reader to tell whether they are the right person. Filing them
                under "想聊的" would put words in their mouth; leaving them at
                the top of the question list buries the ones somebody can act
                on. The follow-up is shown because it is the useful part: it
                tells you what to ask this person when you find them. */}
            {vague.length > 0 && (
              <div className="stack-4">
                <div className="wharf-group">
                  <span className="wharf-group__label">
                    {w.laneVague} · {vague.length}
                  </span>
                  <span className="wharf-group__rule" />
                </div>
                <p className="body-sm" style={{ color: "var(--fg3)" }}>
                  {w.laneVagueNote}
                </p>

                <div className="wharf-rows">
                  {vague.map(({ question, status }) => (
                    <div key={question.id} className="wharf-row-wrap">
                      <Link
                        href={`/members/${question.slug}${langSuffix(lang)}`}
                        className="wharf-row"
                      >
                        <span className="wharf-row__q">{question.text}</span>
                        {question.coach_ask && (
                          <span className="wharf-row__gap">{question.coach_ask}</span>
                        )}
                        <span className="wharf-row__who">{question.name}</span>
                      </Link>

                      {/* ★ The door out of this lane, and the reason the lane is
                          defensible at all. Outside the link rather than in it,
                          because a button inside an anchor is not a button. */}
                      {memberId && question.member_id === memberId && canEdit(status) && (
                        <div className="wharf-row__edit">
                          <EditForm questionId={question.id} text={question.text} copy={w} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {chatting.length > 0 && (
              <div className="stack-4">
                <div className="wharf-group">
                  <span className="wharf-group__label">
                    {w.laneChat} · {chatting.length}
                  </span>
                  <span className="wharf-group__rule" />
                </div>
                <p className="body-sm" style={{ color: "var(--fg3)" }}>
                  {w.laneChatNote}
                </p>

                <div className="wharf-rows">
                  {chatting.map(({ question }) => (
                    <Link
                      key={question.id}
                      href={`/members/${question.slug}${langSuffix(lang)}`}
                      className="wharf-row"
                    >
                      <span className="wharf-row__q">{question.text}</span>
                      <span className="wharf-row__who">{question.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="wharf-how">
              <ChipMark />
              <div className="stack-3">
                <h2 className="h3" style={{ margin: 0 }}>
                  {w.how.title}
                </h2>
                <p className="wharf-how__body">{w.how.body}</p>
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <Link className="btn btn--primary" href={`/${langSuffix(lang)}#signup`}>
                    {w.how.cta}
                  </Link>
                  <Link className="btn btn--secondary" href={`/members${langSuffix(lang)}`}>
                    {w.membersCta}
                  </Link>
                </div>
              </div>
            </div>

            {/* The comic. It *is* the explanation, and down here it can be
                lazy — 117 KB in front of a reader who came for a list is a
                bad trade. */}
            <figure className="comic">
              {[0, 1, 2, 3].map((i) => (
                <div className="comic__panel" key={i}>
                  <picture>
                    <source type="image/avif" srcSet={`/wharf/panel${i + 1}-500.avif`} />
                    <img
                      src={`/wharf/panel${i + 1}-500.jpg`}
                      alt={w.panelAlt[i]}
                      width={500}
                      height={500}
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>

                  {i === 1 && (
                    <>
                      <p className="bubble bubble--2a">{w.strip.q1}</p>
                      <p className="bubble bubble--2b">{w.strip.a1}</p>
                    </>
                  )}
                  {i === 2 && <p className="bubble bubble--3">{w.strip.q2}</p>}
                  {i === 3 && <p className="bubble bubble--4">{w.strip.a2}</p>}
                </div>
              ))}
            </figure>

            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              {w.langNote}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}

function QuestionCard({
  question,
  status,
  lang,
  copy,
  sessions,
  signedIn,
  mine,
}: {
  question: WharfQuestion;
  status: QuestionStatus;
  lang: Lang;
  copy: Copy["wharf"];
  sessions: { value: string; label: string }[];
  signedIn: boolean;
  mine: boolean;
}) {
  const coming = question.replies.filter((reply) => reply.kind === "coming");
  const answers = question.replies.filter((reply) => reply.kind === "answer");
  const thanked = question.replies.find((reply) => reply.id === question.thanked_id);

  return (
    // The id is the question's own address, and it is the point: it makes a
    // single question something you can drop into the group chat, which is the
    // only channel this site actually has.
    <article className={`wharf-item wharf-item--${status}`} id={`q-${question.id}`}>
      <div className="wharf-item__head">
        <span className={`pill pill--${status}`}>{copy.status[status]}</span>
        {question.session && (
          <span className="wharf-item__date mono">{formatSession(question.session, lang)}</span>
        )}
        <a className="wharf-item__anchor" href={`#q-${question.id}`} aria-label={copy.copyLink}>
          #
        </a>
      </div>

      <span className="wharf-item__q">{question.text}</span>

      {/* ⚠️ Load-bearing. The page tells readers the questions are printed
          exactly as written; one that has been rewritten has to say so, or
          that sentence stops being true. */}
      {question.original_text && <span className="wharf-item__edited">{copy.edited}</span>}

      <span className="wharf-item__who">
        <Link className="wharf-item__name" href={`/members/${question.slug}${langSuffix(lang)}`}>
          {question.name}
        </Link>
      </span>

      {coming.length > 0 && (
        <p className="body-sm" style={{ color: "var(--accent)", margin: 0 }}>
          {copy.comingNote.replace("{names}", coming.map((reply) => reply.name).join("、"))}
        </p>
      )}

      {answers.map((answer) => (
        <div className="answer" key={answer.id}>
          <p className="answer__body">{answer.body}</p>

          {answer.has_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="answer__image"
              src={`/api/wharf/image/${answer.id}`}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}

          <span className="answer__by">
            <Link href={`/members/${answer.slug}${langSuffix(lang)}`}>
              {copy.answeredBy.replace("{name}", answer.name)}
            </Link>
          </span>
        </div>
      ))}

      {question.outcome && (
        <p className="body-sm" style={{ color: "var(--fg2)", margin: 0 }}>
          {copy.outcomeShown.replace("{text}", question.outcome)}
        </p>
      )}

      {/* A receipt on one reply, never a total on a person. This site has
          decided four separate times that it does not rank its members. */}
      {thanked && (
        <span className="q__receipt">
          <ChipMark small />
          {copy.thanked.replace("{asker}", question.name).replace("{helper}", thanked.name)}
        </span>
      )}

      {signedIn && (
        <div className="wharf-item__actions">
          {mine && canEdit(status) && (
            <EditForm questionId={question.id} text={question.text} copy={copy} />
          )}
          {canClaim(status) && !mine && (
            <>
              <ComingButton questionId={question.id} sessions={sessions} copy={copy} />
              <AnswerForm questionId={question.id} copy={copy} />
            </>
          )}
          {mine && !question.closed_at && (
            <CloseForm
              questionId={question.id}
              replies={question.replies.map((reply) => ({ id: reply.id, name: reply.name }))}
              copy={copy}
            />
          )}
        </div>
      )}
    </article>
  );
}

/**
 * A serve of hot chips: three of them and the box.
 *
 * Drawn rather than an emoji so the yellow is the page's own token and the
 * shape is the same on every platform. The chips have to splay noticeably
 * wider than the mouth of the box — an earlier version had them short and
 * rounded, and at this size the whole mark read as a crown.
 */
function ChipMark({ small = false }: { small?: boolean }) {
  const size = small ? 16 : 22;

  return (
    <svg
      className="wharf-how__mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="5.4" y="1.2" width="2.6" height="13" rx="0.6" transform="rotate(-16 6.7 7.7)" />
        <rect x="10.7" y="0.4" width="2.6" height="13.8" rx="0.6" />
        <rect x="16" y="1.2" width="2.6" height="13" rx="0.6" transform="rotate(16 17.3 7.7)" />
      </g>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M5 12h14l-1.7 10.4H6.7z"
      />
    </svg>
  );
}
