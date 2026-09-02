import type { Metadata } from "next";
import QRCode from "qrcode";
import { PosterExport } from "@/components/PosterExport";
import { isAdmin } from "@/lib/admin-auth";
import { getCopy } from "@/lib/content";
import { listAllMembers, listRecentAnswers, listRecentDecks, listSignups, listWharfQuestions } from "@/lib/db";
import { formatSession, nextThursdays } from "@/lib/sessions";
import { siteUrl } from "@/lib/site";

import { countPerSession } from "@/lib/signup-stats";
import { isTurnstileConfigured } from "@/lib/turnstile";

// Always read live data, and keep this page out of any search index.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Signups · Vibe Thursday",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ key?: string }>;
};

export default async function AdminPage({ searchParams }: PageProps) {
  const key = (await searchParams).key;

  if (!isAdmin(key)) {
    return (
      <main className="shell section">
        <div className="card stack-3">
          <h1 className="h3">Not authorised</h1>
          <p className="body-sm">
            Open this page as <code>/admin?key=YOUR_ADMIN_TOKEN</code>.
          </p>
        </div>
      </main>
    );
  }

  const [signups, members, questions, answers, decks] = await Promise.all([
    listSignups(),
    listAllMembers(),
    listWharfQuestions(),
    listRecentAnswers(),
    listRecentDecks(),
  ]);

  const wantsToDemo = signups.filter((row) => row.demo_intent === "yes").length;
  const withWechat = signups.filter((row) => row.wechat).length;
  const unverified = signups.filter((row) => row.bot_check && row.bot_check !== "verified").length;

  // People who signed up without picking a Thursday: they work weekday
  // mornings. Kept as its own number because it is the one that answers
  // "how many are we losing to the timeslot", which the total hides.
  const noThursday = signups.filter((row) => row.sessions.length === 0).length;

  /** How many picked each other slot. This decides whether a 2nd session runs. */
  const countSlot = (slot: string) =>
    signups.filter((row) => row.availability.includes(slot)).length;

  // The AI questions are optional, so the denominator for anything below is the
  // people who answered — not `signups.length`. Counting silence as "uses
  // nothing" or "spends nothing" would make the room look lighter than it is.
  const answeredModels = signups.filter((row) => row.ai_models.length > 0);

  /** Everyone using at least one model from that side. Sides overlap: most
   *  people who use a Chinese model also use an overseas one, so these two do
   *  not add up to the number who answered, and are not meant to. */
  const countSide = (prefix: "intl_" | "cn_") =>
    answeredModels.filter((row) => row.ai_models.some((model) => model.startsWith(prefix))).length;

  /** Signups per spend band, in the order the form lists them. */
  const SPEND_BANDS = ["free", "lt_50", "50_200", "200_1000", "gt_1000"] as const;
  const countSpend = (band: string) => signups.filter((row) => row.ai_spend === band).length;

  const nextSession = nextThursdays(1)[0];
  const perSession = countPerSession(signups, [nextSession]);
  const nextSessionRow = perSession.find((session) => session.date === nextSession);

  const stats = [
    { label: "Total", value: signups.length },
    // The headcount for the Thursday that is actually coming up. Kept first
    // among the per-session numbers because it is the one question this page
    // gets opened to answer.
    { label: `Next session ${nextSession}`, value: nextSessionRow?.total ?? 0 },
    { label: "Want to demo", value: wantsToDemo },
    { label: "With WeChat", value: withWechat },
    { label: "Can't do Thu", value: noThursday },
    { label: "Weekday eve", value: countSlot("weekday_evening") },
    { label: "Weekend day", value: countSlot("weekend_day") },
    { label: "Weekend eve", value: countSlot("weekend_evening") },
    { label: "Unverified", value: unverified },
  ];

  // A second row rather than more cards in the first: these answer "how heavy
  // is this room", which is a different question from "who is coming on
  // Thursday", and mixing them makes neither readable at a glance.
  const aiStats = [
    { label: "Said which AI", value: answeredModels.length },
    { label: "Uses overseas", value: countSide("intl_") },
    { label: "Uses China", value: countSide("cn_") },
    ...SPEND_BANDS.map((band) => ({ label: `Spend ${band}`, value: countSpend(band) })),
  ];

  /**
   * Everything the week's poster needs.
   *
   * The questions come from the same call the Wharf and the member wall use,
   * so the poster can only ever show what is already public — a sentence from
   * someone who never ticked "put me on the member wall" cannot reach it.
   *
   * The QR is drawn here rather than in the browser for the same reason the
   * badge's is: `qrcode` is already a dependency, and a server-rendered SVG is
   * one less thing that can be wrong on someone's phone.
   */
  const poster = {
    date: formatSession(nextSession, "zh"),
    time: "10:00 开门 · 10:30 开始",
    // Found by its map link rather than by index. The venue is one of three
    // fact cards on the home page and the poster must not start announcing
    // the opening time as the address because somebody reordered them.
    venue:
      getCopy("zh").hero.facts.find((fact) => fact.href?.includes("maps.google"))?.value ??
      getCopy("zh").hero.facts[1].value,
    signups: nextSessionRow?.total ?? 0,
    // ⚠️ `!closed_at` is not decoration. This poster goes into the group as
    // "here is what people want to ask on Thursday", and a question its own
    // author has already marked settled is an invitation to answer something
    // that is finished. Nothing could be closed when this filter was written.
    questions: questions
      .filter(
        (question) =>
          question.lane === "question" &&
          question.session === nextSession &&
          !question.closed_at,
      )
      .map((question) => ({ text: question.text, name: question.name })),
    // ★ Who answered what this week, printed on the poster that goes into the
    // group. The strongest thing this community can give somebody for
    // answering is to say their name in front of everybody, and the Wednesday
    // announcement is the only channel this site has.
    answers: answers.map((answer) => ({ name: answer.answerer, text: answer.question })),
    url: `${siteUrl()}/wharf`,
    qrSvg: await QRCode.toString(`${siteUrl()}/wharf`, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0b0d", light: "#ffffff" },
    }),
  };

  return (
    <main className="shell section stack-8">
      <div className="stack-4">
        <span className="eyebrow">Vibe Thursday · admin</span>
        <h1>Signups</h1>
      </div>

      {/* ── The week's poster ────────────────────────────────────────
          This site cannot notify anyone: no mail, no push, and most people
          never left an email address. The WeChat group is the channel, and
          this is the thing that gets pasted into it. */}
      <section className="stack-4">
        <div className="group-head">
          <h2 className="h3">本周海报</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            {poster.date} · 发群公告 / 置顶用
          </span>
        </div>
        <PosterExport {...poster} />
      </section>

      {/* ── Casting a demo to the room ───────────────────────────────
          There is no projector at the venue, so a demo is either three people
          leaning over one laptop or it does not happen. Opening a room here
          gives back two links: one to present from, one for the room to scan.

          It sits next to "Want to demo" on purpose — that number is how many
          people said on the sign-up form that they had something to show, and
          this is the thing to do about it. */}
      <section className="stack-4" id="deck">
        <div className="group-head">
          <h2 className="h3">投屏</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            没有投影仪 · 开一个房间，大家扫码跟着看
          </span>
        </div>

        {/* An ordinary form: the route answers with a 303 to the presenter's
            page, so this needs no script. */}
        <form method="post" action="/api/deck" className="stack-3">
          <input type="hidden" name="key" value={key} />
          <div className="deck-build__join">
            <input
              className="field"
              type="text"
              name="title"
              placeholder="谁讲什么（可留空）"
              maxLength={120}
              style={{ maxWidth: "20rem" }}
            />
            <button className="btn btn--primary" type="submit">
              开一个房间
            </button>
          </div>
        </form>

        {decks.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>
            还没有开过房间。房间七天后自己消失。
          </p>
        ) : (
          <ul className="stack-4" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {decks.map((deck) => (
              <li key={deck.code} className="card stack-3">
                <div className="deck-build__join">
                  <span className="deck__code-big">{deck.code}</span>
                  <span className="body-sm" style={{ color: "var(--fg3)" }}>
                    {deck.title ? `${deck.title} · ` : ""}
                    {deck.slideCount} 页 · {deck.createdAt.toISOString().slice(0, 10)}
                  </span>
                </div>

                {/* ★ Both links, every time.
                    The presenter one used to be handed over once, in the
                    redirect, and never shown again — so closing the tab lost
                    the room. That is a bad property five minutes before
                    somebody stands up, and it protects nothing: this page can
                    already mint as many rooms and keys as it likes. */}
                <div className="stack-2">
                  <p className="body-sm">
                    <strong>我来演示</strong> ——{" "}
                    <a className="mono hl" href={`/present/${deck.code}?k=${deck.presenterKey}`}>
                      /present/{deck.code}
                    </a>{" "}
                    <span style={{ color: "var(--fg3)" }}>
                      传幻灯片、拿二维码、翻页都在这一页。这条链接就是控制权，可以发给今天讲的人。
                    </span>
                  </p>
                  <p className="body-sm">
                    <strong>大家跟着看</strong> ——{" "}
                    <a className="mono" href={`/d/${deck.code}`}>
                      /d/{deck.code}
                    </a>{" "}
                    <span style={{ color: "var(--fg3)" }}>
                      念房间号 {deck.code}，或者让他们扫演示页上的二维码。
                    </span>
                  </p>
                </div>

                <form method="post" action="/api/admin/deck">
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="code" value={deck.code} />
                  <button className="btn btn--secondary" type="submit">
                    关掉这个房间
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="grid-auto" style={{ margin: 0 }}>
        {stats.map((stat) => (
          <div className="card stack-2" key={stat.label}>
            <dt className="eyebrow" style={{ color: "var(--fg3)" }}>
              {stat.label}
            </dt>
            <dd className="h3 hl" style={{ margin: 0 }}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="stack-4">
        <div className="group-head">
          <h2 className="h3">AI usage</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            Both questions are optional — {signups.length - answeredModels.length} of{" "}
            {signups.length} left the model question blank, and a blank is not a zero.
          </span>
        </div>

        <dl className="grid-auto" style={{ margin: 0 }}>
          {aiStats.map((stat) => (
            <div className="card stack-2" key={stat.label}>
              <dt className="eyebrow" style={{ color: "var(--fg3)" }}>
                {stat.label}
              </dt>
              <dd className="h3 hl" style={{ margin: 0 }}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Turnstile is advisory, so a dropped key no longer breaks the form —
          it quietly stops verifying, which is exactly the kind of silent
          degradation you would otherwise never notice. Hence stating it. */}
      {isTurnstileConfigured() ? (
        <p className="alert">
          Bot protection: Turnstile active, <strong>advisory</strong>. A submission with no token
          is still accepted and marked <code>skipped</code> — the challenge does not complete in
          every browser, WeChat&rsquo;s in particular. Only a token that is present and invalid is
          rejected. Rate limit: 6 submissions per IP per hour.
        </p>
      ) : (
        <p className="alert alert--error" role="alert">
          Bot protection: <strong>Turnstile not configured</strong>. Signups still work, but
          nothing is verified — only the honeypot and the rate limit are active. Set
          NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.
        </p>
      )}

      {/* Headcount per Thursday. Deliberately only headcounts: see the note in
          signup-stats.ts for why "how many are new" cannot be answered here. */}
      {/* ── The Wharf ────────────────────────────────────────────────
          Two controls, and the first is the one that matters: the lane rule
          is a heuristic and this button is what makes it acceptable for it to
          stay simple. Moving two a week beats any rule that could be written
          for twenty sentences. */}
      <section className="stack-4" id="wharf">
        <div className="group-head">
          <h2 className="h3">Wharf</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            {questions.filter((q) => q.lane === "question").length} questions ·{" "}
            {questions.filter((q) => q.lane === "vague").length} not-clear-yet ·{" "}
            {questions.filter((q) => q.lane === "chat").length} looking-to-meet ·{" "}
            {questions.reduce((n, q) => n + q.replies.length, 0)} replies
          </span>
        </div>

        <div className="table-scroll">
          {/* Runs the coach over every question nobody has acted on and files
              the ones it cannot make sense of under "not clear yet". It costs
              a fraction of a cent, takes about a second a row, and every move
              it makes is undone by one click in the table below. */}
          <form method="post" action="/api/admin/wharf" style={{ marginBottom: "var(--space-4)" }}>
            <input type="hidden" name="key" value={key} />
            <input type="hidden" name="action" value="triage" />
            <button className="btn btn--secondary btn--sm" type="submit">
              Sort the vague ones out
            </button>
          </form>

          <table className="table">
            <thead>
              <tr>
                <th>Lane</th>
                <th>Question</th>
                <th>Who</th>
                <th>Replies</th>
                <th>Move</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id}>
                  <td>{question.lane}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: "36ch" }}>{question.text}</td>
                  <td>{question.name}</td>
                  <td>
                    {question.replies.length === 0
                      ? "—"
                      : question.replies.map((reply) => (
                          <form
                            key={reply.id}
                            method="post"
                            action="/api/admin/wharf"
                            style={{ display: "inline" }}
                          >
                            <input type="hidden" name="key" value={key} />
                            <input type="hidden" name="action" value="delete-reply" />
                            <input type="hidden" name="id" value={reply.id} />
                            <button className="linkish" type="submit">
                              {reply.kind === "answer" ? "answer" : "coming"}
                              {reply.has_image ? " 🖼" : ""} ×
                            </button>
                          </form>
                        ))}
                  </td>
                  <td>
                    {/* One button per lane it is not already in. A toggle was
                        enough while there were two lanes; with three, a toggle
                        silently makes one of them unreachable — and `vague` is
                        the one a triage pass writes, so it is exactly the one
                        that needs undoing by hand. */}
                    {(["question", "vague", "chat"] as const)
                      .filter((lane) => lane !== question.lane)
                      .map((lane) => (
                        <form
                          key={lane}
                          method="post"
                          action="/api/admin/wharf"
                          style={{ display: "inline" }}
                        >
                          <input type="hidden" name="key" value={key} />
                          <input type="hidden" name="action" value="lane" />
                          <input type="hidden" name="id" value={question.id} />
                          <input type="hidden" name="lane" value={lane} />
                          <button className="linkish" type="submit">
                            → {lane}{" "}
                          </button>
                        </form>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack-4" id="sessions">
        <div className="group-head">
          <h2 className="h3">Per session</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            Signed up, not turnout — the first session ran at about 70–77% of it.
          </span>
        </div>

        <p className="alert">
          This is everyone who picked that date, not who is new. Past Thursdays are never
          selectable, so someone who signs up the day after a session can only pick the next
          one — which makes them look like a first-timer. Who still needs pulling into the
          WeChat group is a set difference against{" "}
          <code>sydney-meetup/data/已处理微信号.txt</code>, and this database does not know
          who is in the group.
        </p>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Signed up</th>
                <th scope="col">Want to demo</th>
              </tr>
            </thead>
            <tbody>
              {perSession.map((session) => (
                <tr key={session.date}>
                  <td className="mono" style={{ color: session.date === nextSession ? "var(--fg1)" : undefined }}>
                    {session.date}
                    {session.date === nextSession ? " ← next" : ""}
                  </td>
                  <td className="mono">{session.total}</td>
                  <td className="mono">{session.wantsToDemo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div>
        <a className="btn btn--secondary" href={`/api/admin/export?key=${encodeURIComponent(key!)}`}>
          Download CSV
        </a>
      </div>

      {/* Member cards. Here because the claim check is soft on purpose — the
          undo it was traded against has to actually exist somewhere. */}
      <section className="stack-4" id="members">
        <div className="group-head">
          <h2 className="h3">Member cards</h2>
          <span className="body-sm mono" style={{ color: "var(--fg3)" }}>
            {members.filter((m) => m.published && !m.hidden).length} live / {members.length} total
          </span>
        </div>

        {members.length === 0 ? (
          <p className="alert">Nobody has claimed a card yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Handle</th>
                  <th scope="col">Headline</th>
                  <th scope="col">State</th>
                  <th scope="col">Updated</th>
                  <th scope="col">On the wall</th>
                </tr>
              </thead>
              <tbody>
                {members.map((row) => (
                  <tr key={row.id}>
                    <td style={{ color: "var(--fg1)" }}>{row.display_name}</td>
                    <td className="mono">
                      <a href={`/members/${row.slug}`}>/{row.slug}</a>
                    </td>
                    <td style={{ whiteSpace: "normal", minWidth: "280px" }}>{row.headline ?? "—"}</td>
                    <td style={{ color: row.published ? "var(--fg2)" : "var(--warning)" }}>
                      {row.published ? "published" : "draft"}
                    </td>
                    <td className="mono">{row.updated_at}</td>
                    <td>
                      {/* A form, not fetch: /admin ships no client JS. */}
                      <form action="/api/admin/member" method="post">
                        <input type="hidden" name="key" value={key!} />
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="hidden" value={row.hidden ? "false" : "true"} />
                        <button type="submit" className="link-button">
                          {row.hidden ? "hidden — put back" : "visible — hide"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {signups.length === 0 ? (
        <p className="alert">No signups yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">WeChat</th>
                <th scope="col">Demo</th>
                <th scope="col">Session</th>
                <th scope="col">AI</th>
                <th scope="col">Spend</th>
                <th scope="col">Building</th>
                <th scope="col">Source</th>
                <th scope="col">Lang</th>
                <th scope="col">Bot check</th>
                <th scope="col">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((row) => (
                <tr key={row.id}>
                  <td style={{ color: "var(--fg1)" }}>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.wechat ?? "—"}</td>
                  <td>{row.demo_intent ?? "—"}</td>
                  <td className="mono">{row.first_session ?? "—"}</td>
                  {/* Stripped of the region prefix: the column is narrow, and
                      the side is already counted in the cards above. */}
                  <td style={{ whiteSpace: "normal", minWidth: "160px" }}>
                    {row.ai_models.length > 0
                      ? row.ai_models.map((model) => model.replace(/^(intl_|cn_)/, "")).join(", ")
                      : "—"}
                  </td>
                  <td className="mono">{row.ai_spend ?? "—"}</td>
                  {/* The only free-text column, so it is the only one allowed
                      to wrap rather than widen the table indefinitely. */}
                  <td style={{ whiteSpace: "normal", minWidth: "280px" }}>{row.building ?? "—"}</td>
                  <td>{row.source ?? "—"}</td>
                  <td>{row.lang ?? "—"}</td>
                  <td style={{ color: row.bot_check === "verified" ? "var(--fg2)" : "var(--warning)" }}>
                    {row.bot_check ?? "—"}
                  </td>
                  <td className="mono">{row.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
