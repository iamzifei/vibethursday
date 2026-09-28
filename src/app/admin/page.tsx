import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { CheckinDesk } from "@/components/CheckinDesk";
import { FeedbackDesk } from "@/components/FeedbackDesk";
import { OrderDesk } from "@/components/OrderDesk";
import { PosterExport } from "@/components/PosterExport";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { getCopy } from "@/lib/content";
import { capacityAlert, SESSION_CAP } from "@/lib/capacity";
import { buildRoster, checkinCode } from "@/lib/checkin";
import {
  countCheckins,
  listAllMembers,
  listCheckins,
  listFeedback,
  listOrders,
  getSessionQuestions,
  listRecentAnswers,
  listRecentDecks,
  listRoster,
  listSignups,
  listWharfQuestions,
} from "@/lib/db";
import { canGiveFeedback, feedbackCode, isSessionDate, sessionForFeedback, summarise } from "@/lib/feedback";
import { barSheet, canOrder, orderCode } from "@/lib/order";
import { formatQuestionList } from "@/lib/session-questions";
import { focusSession, formatSession, nextThursdays, sydneyToday } from "@/lib/sessions";
import { requestOrigin } from "@/lib/request-origin";
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
  /** `fb` picks which session's feedback is read out below the summary. */
  searchParams: Promise<{ key?: string; fb?: string; q?: string; all?: string; cq?: string }>;
};

export default async function AdminPage({ searchParams }: PageProps) {
  const { key, fb, q, all, cq } = await searchParams;

  // ★ The link still carries the token; the address bar no longer keeps it.
  // Arriving with ?key= goes straight to the one route allowed to set a
  // cookie, which signs the session in and comes back here without it.
  if (key) {
    const next = fb ? `/admin?fb=${encodeURIComponent(fb)}` : "/admin";
    redirect(`/api/admin/session?key=${encodeURIComponent(key)}&next=${encodeURIComponent(next)}`);
  }

  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <div className="card stack-3">
          <h1 className="h3">Not authorised</h1>
          <p className="body-sm">
            Open <code>/admin?key=YOUR_ADMIN_TOKEN</code> once. It signs this browser in for
            30 days and takes the token straight back out of the address bar.
          </p>
        </div>
      </main>
    );
  }

  // The desk is set up for the session in focus, not the next one: on a
  // Thursday afternoon `nextThursdays` has already rolled to next week, and
  // the afternoon is when the organiser fixes up who was there this morning.
  const desk = focusSession().date;

  // Same session as the check-in desk, not `nextThursdays(1)[0]`: that one
  // rolls to next week at noon on the day, and the afternoon is exactly when a
  // duplicate or a no-show gets cleaned off this morning's sheet.
  const orderSession = desk;

  const [signups, members, questions, answers, decks, attendance, deskRoster, deskCheckins, feedback, orders, deskQuestions] =
    await Promise.all([
      listSignups(),
      listAllMembers(),
      listWharfQuestions(),
      listRecentAnswers(),
      listRecentDecks(),
      countCheckins(),
      listRoster(desk),
      listCheckins(desk),
      // Every form, once. The summary table and the answers read out below it
      // are both derived from this one array, so the totals and the sentences
      // under them cannot disagree about what was said.
      listFeedback(),
      listOrders(orderSession),
      getSessionQuestions(desk),
    ]);

  // Whatever host this page was actually opened on, so a code scanned off a
  // phone goes back to the same deployment. Read once: the desk's code and the
  // poster's code both hang off it.
  const origin = await requestOrigin();
  const deskUrl = `${origin}/checkin?s=${desk}&k=${checkinCode(desk)}`;
  const deskQr = await QRCode.toString(deskUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0b0d", light: "#ffffff" },
  });

  // ⚠️ Not `desk`. The check-in desk looks forward from Monday — see
  // `sessionForFeedback`, which walks back to the last Thursday instead. Using
  // `desk` here handed out a code for a session that had not happened on three
  // days out of seven, and hid the one whose window was actually open.
  const feedbackSession = sessionForFeedback(sydneyToday().toISOString().slice(0, 10));
  const feedbackUrl = `${origin}/feedback?s=${feedbackSession}&k=${feedbackCode(feedbackSession)}`;
  const feedbackQr = await QRCode.toString(feedbackUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0b0d", light: "#ffffff" },
  });

  const orderUrl = `${origin}/order?s=${orderSession}&k=${orderCode(orderSession)}`;
  const orderQr = await QRCode.toString(orderUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0b0d", light: "#ffffff" },
  });

  const feedbackSummary = summarise(
    feedback.map((row) => ({
      session: row.session,
      rating: row.rating,
      // Stored as free text by the column type; narrowed back here, and an
      // unrecognised value counts as "did not answer" rather than as a "no".
      recommend:
        row.recommend === "yes" || row.recommend === "maybe" || row.recommend === "no"
          ? row.recommend
          : null,
    })),
  ).map((row) => ({ ...row, attended: attendance.get(row.session) ?? null }));

  // Which session is read out below. The one picked, else the newest one that
  // has any feedback, else the session in focus — so this never shows an empty
  // list while some other session has answers sitting in it.
  const showing =
    isSessionDate(fb) && feedbackSummary.some((row) => row.session === fb)
      ? fb
      : (feedbackSummary[0]?.session ?? feedbackSession);

  const wantsToDemo = signups.filter((row) => row.demo_intent === "yes").length;
  const withWechat = signups.filter((row) => row.wechat).length;
  // Split, because merged they carried no signal: "skipped" is no token at all
  // (the widget never finished), "unavailable" is Cloudflare not answering.
  const noBotCheck = signups.filter((row) => row.bot_check === "skipped").length;
  const botCheckDown = signups.filter((row) => row.bot_check === "unavailable").length;

  // People who signed up without picking a Thursday: they work weekday
  // mornings. Kept as its own number because it is the one that answers
  // "how many are we losing to the timeslot", which the total hides.
  // Waitlisted people did pick a Thursday; only a row with neither is "can't do mornings".
  const noThursday = signups.filter((row) => row.sessions.length === 0 && row.waitlist.length === 0).length;

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
  // Waitlisted signups per session, from the same rows. Not part of
  // `countPerSession` on purpose: a waitlisted person has no place, and every
  // existing headcount must keep meaning "people with a place".
  const deskRow = perSession.find((session) => session.date === desk);

  // The detail table: this session by default (booked or waitlisted), all of
  // history with ?all=1, narrowed by ?q= across name, WeChat, email and "building".
  const needle = (q ?? "").trim().toLowerCase();
  const tableRows = signups.filter(
    (row) =>
      (all === "1" || row.sessions.includes(desk) || row.waitlist.includes(desk)) &&
      (!needle ||
        [row.name, row.wechat, row.email, row.building].some((field) => field?.toLowerCase().includes(needle))),
  );

  // Who is waiting for this session, oldest signup first, and whether the
  // numbers look like a script rather than people (capacity.ts).
  const deskWaitlist = signups
    .filter((row) => row.waitlist.includes(desk))
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const dayAgo = new Date().getTime() - 24 * 60 * 60 * 1000;
  const unverifiedLastDay = signups.filter(
    (row) =>
      (row.sessions.includes(desk) || row.waitlist.includes(desk)) &&
      row.bot_check !== "verified" &&
      Date.parse(`${row.created_at.replace(" ", "T")}:00Z`) > dayAgo,
  ).length;
  const alert = capacityAlert({ waitlist: deskWaitlist.length, unverifiedLastDay });
  const waitlistBySession = new Map<string, number>();
  for (const signup of signups) {
    for (const date of new Set(signup.waitlist)) {
      waitlistBySession.set(date, (waitlistBySession.get(date) ?? 0) + 1);
    }
  }
  const nextSessionRow = perSession.find((session) => session.date === nextSession);

  const stats = [
    { label: "报名行数（全部历史，含测试）", value: signups.length },
    // The headcount for the Thursday that is actually coming up. Kept first
    // among the per-session numbers because it is the one question this page
    // gets opened to answer.
    {
      label: `下一场 ${nextSession}（报上 / 上限 · 候补）`,
      value: `${nextSessionRow?.total ?? 0} / ${SESSION_CAP} · ${waitlistBySession.get(nextSession) ?? 0}`,
    },
    // The form preselects "先来听听", so this is who changed it, not a turnout signal.
    { label: "选了「想讲讲」的（默认是先来听听）", value: wantsToDemo },
    { label: "留了微信号", value: withWechat },
    { label: "周四上午来不了", value: noThursday },
    { label: "工作日晚上能来", value: countSlot("weekday_evening") },
    { label: "周末白天能来", value: countSlot("weekend_day") },
    { label: "周末晚上能来", value: countSlot("weekend_evening") },
    { label: "没跑人机验证", value: noBotCheck },
    { label: "验证服务不可用", value: botCheckDown },
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
    session: nextSession,
    date: formatSession(nextSession, "zh"),
    time: "10:30 开门 · 10:45 开始",
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
    // Printed beside the QR rather than encoded in it: an address somebody can
    // read off a screenshot, and one that works on the six days when the code
    // beside it does not.
    url: `${siteUrl()}/wharf`,
    /**
     * ★ The QR is the check-in code for the session the poster is for — not
     * `desk`, which on a Thursday afternoon has already fallen a week behind
     * the poster, and no longer the Wharf link this used to be.
     *
     * The code only works on the day it names, which is why the readable
     * address beside it has to be one that works on the other six.
     */
    // ⚠️ `siteUrl()`, not `requestOrigin()` — the one difference between this
    // QR and the desk's, and it matters because of where each one ends up.
    // The desk code is scanned in the room off the screen that generated it,
    // so following the request's host is right for it. This one gets pasted
    // into the group. Generated from a laptop on localhost, `requestOrigin()`
    // would encode `http://localhost:3000/checkin?…` — dead for everybody who
    // scans it — while the address printed next to it still reads
    // vibethursday.com, so nothing on the poster would look wrong.
    qrSvg: await QRCode.toString(`${siteUrl()}/checkin?s=${nextSession}&k=${checkinCode(nextSession)}`, {
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
        <h1>后台</h1>
      </div>

      {/* Four groups in the order a week actually runs. Sticky, and it scrolls
          sideways on a phone rather than wrapping into two rows. */}
      <nav className="admin-jump" aria-label="后台分组">
        <a href="#week">本周</a>
        <a href="#after">散场后</a>
        <a href="#community">社群</a>
        <a href="#data">数据与工具</a>
      </nav>

      <section className="stack-8 admin-group" id="week">
        <h2 className="eyebrow">① 本周</h2>
      {/* ── This week at a glance ──────────────────────────────────────
          Numbers already read above; nothing new is queried for this. */}
      <p className="body-sm admin-glance">
        <strong>{desk}</strong> · 报名 {deskRow?.total ?? 0} / {SESSION_CAP} · 候补{" "}
        {waitlistBySession.get(desk) ?? 0} · 已签到 {deskCheckins.length} · 点单 {orders.length} 杯
      </p>

      {alert && (
        <p className="alert" role="status" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
          候补 {alert.waitlist} 人 · 24 小时内 {alert.unverifiedLastDay} 条报名没过人机验证。看一下下面的候补名单和报名明细，是不是真人。
        </p>
      )}

      {/* ── Waitlist ─────────────────────────────────────────────────
          Who is waiting, with a way to give each a place. Promoting can take
          the session over the cap; that is a decision made here, not by the form. */}
      <section className="stack-4" id="waitlist">
        <div className="group-head">
          <h2 className="h3">候补 · {desk}</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            {deskWaitlist.length} 人 · 按报名先后
          </span>
        </div>
        {deskWaitlist.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>
            没有人在候补。
          </p>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="候补名单">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">名字</th>
                  <th scope="col">微信</th>
                  <th scope="col">在做什么</th>
                  <th scope="col">报名时间</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {deskWaitlist.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className="mono">{row.wechat ?? "—"}</td>
                    <td style={{ whiteSpace: "normal", minWidth: "200px" }}>{row.building ?? "—"}</td>
                    <td className="mono">{row.created_at}</td>
                    <td>
                      <form method="post" action="/api/admin/waitlist">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="session" value={desk} />
                        <button className="linkish" type="submit">
                          给他位子
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

      {/* ── Drinks ───────────────────────────────────────────────────
          The sheet the café asked for: every line has a name, so payment is
          taken by name and nobody walks off with the wrong cup. */}
      <OrderDesk
        session={orderSession}
        isOpen={canOrder(orderSession, sydneyToday().toISOString().slice(0, 10))}
        url={orderUrl}
        qrSvg={orderQr}
        orders={orders}
        sheet={barSheet(orders)}
      />

      {/* ── This week's Q&A ──────────────────────────────────────────
          The shortlist the group voted on, pasted here; /go shows it. */}
      <section className="stack-4" id="questions">
        <div className="group-head">
          <h2 className="h3">本周问答 · {desk}</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            场前在 /go 显示候选，当天显示今天聊的
          </span>
        </div>
        <form method="post" action="/api/admin/questions" className="stack-3">
          <input type="hidden" name="session" value={desk} />
          <textarea
            className="field"
            name="questions"
            rows={6}
            defaultValue={formatQuestionList(deskQuestions)}
            placeholder={"一行一个问题；票最多的两个在行首加 *"}
          />
          <p className="field-hint">一行一个问题，行首加 * 表示当天要聊的。序号会自动去掉，最多 8 个。清空后保存即删除。</p>
          <div>
            <button className="btn btn--secondary" type="submit">
              保存
            </button>
          </div>
        </form>
      </section>

      {/* ── Check-in ─────────────────────────────────────────────────
          The code for the table and the list of who has tapped it. The one
          place on the site that knows who was in the room. */}
      <CheckinDesk
        session={desk}
        isToday={desk === sydneyToday().toISOString().slice(0, 10)}
        url={deskUrl}
        qrSvg={deskQr}
        roster={buildRoster(desk, deskRoster, deskCheckins)}
        checkins={deskCheckins}
        query={cq}
      />

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

      </section>

      <section className="stack-8 admin-group" id="after">
        <h2 className="eyebrow">② 散场后</h2>
      {/* ── Feedback ─────────────────────────────────────────────────
          The other half of a session: check-in says who was in the room,
          this says whether the morning was worth their while. */}
      <FeedbackDesk
        session={feedbackSession}
        isOpen={canGiveFeedback(feedbackSession, sydneyToday().toISOString().slice(0, 10))}
        url={feedbackUrl}
        qrSvg={feedbackQr}
        summary={feedbackSummary}
        showing={showing}
        answers={feedback.filter((row) => row.session === showing)}
      />

      </section>

      <details className="disclosure admin-group" id="community">
        <summary>③ 社群：码头与成员卡片</summary>
        <div className="disclosure__body stack-8">
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
                      {row.hidden ? (
                        <form action="/api/admin/member" method="post">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="hidden" value="false" />
                          <button type="submit" className="link-button">
                            已隐藏 · 放回墙上
                          </button>
                        </form>
                      ) : (
                        // Hiding takes a card off the public wall: two steps.
                        <details className="confirm">
                          <summary className="link-button">公开中 · 隐藏</summary>
                          <form action="/api/admin/member" method="post">
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="hidden" value="true" />
                            <button type="submit" className="link-button">
                              确认隐藏
                            </button>
                          </form>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

        </div>
      </details>

      <details className="disclosure admin-group" id="data">
        <summary>④ 数据与工具：统计、AI 用量、投屏、报名明细</summary>
        <div className="disclosure__body stack-8">
      {/* Headcount per Thursday. Deliberately only headcounts: see the note in
          signup-stats.ts for why "how many are new" cannot be answered here. */}
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

      <section className="stack-4" id="sessions">
        <div className="group-head">
          <h2 className="h3">Per session</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            Signed up is not turnout — the first session ran at about 70–77% of it. Turned up
            is from check-ins, and only exists since they started.
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
                <th scope="col">报上 / 上限</th>
                <th scope="col">候补</th>
                <th scope="col">签到</th>
                <th scope="col">想讲讲</th>
              </tr>
            </thead>
            <tbody>
              {perSession.map((session) => (
                <tr key={session.date}>
                  <td className="mono" style={{ color: session.date === nextSession ? "var(--fg1)" : undefined }}>
                    {session.date}
                    {session.date === nextSession ? " ← next" : ""}
                  </td>
                  <td className="mono">
                    {session.total} / {SESSION_CAP}
                  </td>
                  <td className="mono">{waitlistBySession.get(session.date) ?? 0}</td>
                  <td className="mono">{attendance.get(session.date) ?? "—"}</td>
                  <td className="mono">{session.wantsToDemo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <a className="btn btn--secondary" href="/api/admin/export">
            导出全部报名 CSV
          </a>
          <a className="btn btn--secondary" href={`/api/admin/export?what=orders&session=${desk}`}>
            导出点单 CSV · {desk}
          </a>
          <a className="btn btn--secondary" href={`/api/admin/export?what=checkins&session=${desk}`}>
            导出签到 CSV · {desk}
          </a>
        </div>
      </div>

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

      {/* Search and scope: a GET form, so it works with no script and the URL
          can be kept. */}
      <form method="get" action="/admin" className="stack-2" style={{ maxWidth: "36rem" }}>
        <label className="label" htmlFor="admin-q">
          报名明细 · {all === "1" ? "全部历史" : `只看 ${desk}`}
        </label>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <input className="field" id="admin-q" name="q" defaultValue={q ?? ""} placeholder="名字、微信、邮箱、在做什么" style={{ flex: "1 1 12rem" }} />
          {all === "1" && <input type="hidden" name="all" value="1" />}
          <button className="btn btn--secondary" type="submit">
            搜
          </button>
        </div>
        <p className="body-sm" style={{ margin: 0 }}>
          {tableRows.length} 行 ·{" "}
          <a className="hl" href={all === "1" ? "/admin#data" : "/admin?all=1#data"}>
            {all === "1" ? `只看 ${desk}` : "看全部历史"}
          </a>
        </p>
      </form>

      {tableRows.length === 0 ? (
        <p className="alert">没有符合的报名。</p>
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
              {tableRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ color: "var(--fg1)" }}>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.wechat ?? "—"}</td>
                  <td>{row.demo_intent ?? "—"}</td>
                  <td className="mono">
                    {row.first_session ?? "—"}
                    {row.first_session && row.waitlist.includes(row.first_session) ? "（候补）" : ""}
                  </td>
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
        </div>
      </details>

    </main>
  );
}
