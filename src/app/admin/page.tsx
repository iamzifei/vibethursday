import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { CheckinDesk } from "@/components/CheckinDesk";
import { FeedbackDesk } from "@/components/FeedbackDesk";
import { PosterExport } from "@/components/PosterExport";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { getCopy } from "@/lib/content";
import { capacityAlert, capFor, SESSION_CAP } from "@/lib/capacity";
import { looksLikeWechatId } from "@/lib/wechat-id";
import { buildRoster, checkinCode } from "@/lib/checkin";
import { COURSE, IP_COURSE, MEMBERSHIP } from "@/lib/course";
import { dinnerConfig } from "@/lib/dinner";
import {
  countCheckins,
  listAllMembers,
  listCheckins,
  listCourseOrders,
  listTuesdayFeeDesk,
  listShareCandidates,
  listDinner,
  listFeedback,
  listLoginStats,
  listPhotosForReview,
  listRecentAnswers,
  listRecentDecks,
  listRoster,
  listSignups,
  listWharfQuestions,
  listProgress,
  listMemberships,
  listPersonRoles,
} from "@/lib/db";
import { canGiveFeedback, feedbackCode, isSessionDate, sessionForFeedback, summarise } from "@/lib/feedback";
import { walkInMatches } from "@/lib/walk-in-match";
import { deskSession, feeFor, formatSession, isSpecialSession, nextThursdays, SPECIAL_SESSIONS, sydneyToday, upcomingSpecialSessions } from "@/lib/sessions";
import { requestOrigin } from "@/lib/request-origin";
import { siteUrl } from "@/lib/site";
import { waitlistFor } from "@/lib/waitlist-order";
import { ADMIN_VIEW_LABEL, ADMIN_VIEWS, adminHref, adminView } from "@/lib/admin-nav";

import { compositionPerSession, countPerSession, tuesdaySplit, type Tally } from "@/lib/signup-stats";
import { isTurnstileConfigured } from "@/lib/turnstile";

// Always read live data, and keep this page out of any search index.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Signups · Vibe Thursday",
  robots: { index: false, follow: false },
};

type PageProps = {
  /** `fb` picks which session's feedback is read out below the summary. */
  searchParams: Promise<{ key?: string; fb?: string; q?: string; all?: string; cq?: string; msg?: string; view?: string }>;
};

/** What each `login_events.method` means, for the logins table. */
const LOGIN_METHOD_LABEL: Record<string, string> = {
  wechat_silent: "微信内自动认出（新设备）",
  wechat_session: "微信登录按钮",
  wechat_link: "手机微信确认 / 首次绑定",
  wechat_qr: "电脑扫码",
  lookup: "我的报名 · 微信号 + 名字",
  signup: "报名时记住",
  claim: "认领名片",
};

export default async function AdminPage({ searchParams }: PageProps) {
  const { key, fb, q, all, cq, msg, view: viewParam } = await searchParams;
  // One task at a time (2026-11-02): see ADMIN_VIEWS.
  const view = adminView(viewParam);

  // ★ The link still carries the token; the address bar no longer keeps it.
  // Arriving with ?key= goes straight to the one route allowed to set a
  // cookie, which signs the session in and comes back here without it.
  if (key) {
    const next = fb ? `/admin?view=after&fb=${encodeURIComponent(fb)}` : "/admin";
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
  // On a Build Tuesday the desk is that Tuesday (`deskSession`).
  const desk = deskSession();

  const [signups, members, questions, answers, decks, attendance, deskRoster, deskCheckins, feedback, photos, logins, courseOrders, oldCourseOrders, memberOrders] =
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
      listPhotosForReview(),
      // Counting only; a failure here must not take the admin page down.
      listLoginStats().catch(() => []),
      listCourseOrders(IP_COURSE.id).catch(() => []),
      // The 10/25 membership class is no longer on sale (2026-11-01), but an
      // order still waiting for its transfer must stay markable as paid here.
      listCourseOrders(COURSE.id).then((rows) => rows.filter((o) => o.status === "pending")).catch(() => []),
      // The 共创会员 bought by card on /join (2026-11-02). Settled by Stripe,
      // so this list is for reading, not marking.
      listCourseOrders(MEMBERSHIP.id).catch(() => []),
    ]);

  // Thursday's opening shares (2026-10-15): the next Thursday's volunteers,
  // to pick 2–3 from. Fails soft.
  const shareSession = nextThursdays(1)[0];
  const shareCandidates = await listShareCandidates(shareSession).catch(() => []);
  // The dinner after that Thursday (2026-10-15), when one is configured.
  const dinner = dinnerConfig();
  const dinnerSeats = dinner ? await listDinner(shareSession).catch(() => []) : [];

  // Build Tuesday's fee (2026-10-14): today's Tuesday if it is a paid one, and
  // the paid Tuesdays still open for booking. Counting only fails soft.
  const feeTuesdays = [...new Set([desk, ...upcomingSpecialSessions().map((special) => special.date)])].filter(
    (date) => feeFor(date) !== null,
  );
  // The overview tiles (2026-11-02): counts only, each failing soft.
  const [progressEntries, memberships, personRoles] = await Promise.all([
    listProgress().catch(() => []),
    listMemberships().catch(() => []),
    listPersonRoles().catch(() => []),
  ]);
  const tuesdayFees = await Promise.all(
    feeTuesdays.map(async (session) => ({ session, rows: await listTuesdayFeeDesk(session).catch(() => []) })),
  );

  // Whatever host this page was actually opened on, so a code scanned off a
  // phone goes back to the same deployment. Read once: the desk's code and the
  // poster's code both hang off it.
  // Door walk-ins that look like an earlier signup (James 2026-10-01).
  const walkIns = walkInMatches(signups, new Date());

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
  // Open Build Tuesdays are listed even before anyone signs up, like the next Thursday.
  const perSession = countPerSession(signups, [nextSession, ...upcomingSpecialSessions().map((special) => special.date)]);
  // Waitlisted signups per session, from the same rows. Not part of
  // `countPerSession` on purpose: a waitlisted person has no place, and every
  // existing headcount must keep meaning "people with a place".
  const deskRow = perSession.find((session) => session.date === desk);

  // Who is in each room, for the same sessions as the table above and in the
  // same order. For deciding what a morning covers and whether to split it.
  // Capped at the first eight rows (upcoming first, then the most recent past
  // ones): the full history only grows, and older rows predate the questions.
  // Tapped "small class" on the confirmation, newest first (listSignups' order).
  const classInterest = signups.filter((row) => row.interest === "class");
  const composition = compositionPerSession(signups, perSession.slice(0, 8).map((session) => session.date));
  const signupFields = getCopy("zh").signup.fields;
  /** One cell: every answer in the order the form lists it, zero counts left out. */
  const tallyCell = (counts: Tally, options: readonly { value: string; label: string }[], blank: number) => {
    const parts = options
      .filter((option) => counts[option.value])
      .map((option) => `${option.label} ${counts[option.value]}`);
    if (blank > 0) parts.push(`未答 ${blank}`);
    return parts.length > 0 ? parts.join(" · ") : "—";
  };
  // Short labels for the purpose codes: the form's own labels are sentences.
  const PURPOSE_SHORT = [
    { value: "biz", label: "做生意" },
    { value: "product", label: "做产品" },
    { value: "tech", label: "做技术" },
    { value: "learn", label: "学习" },
    { value: "other", label: "其他" },
  ];

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
  const deskWaitlist = waitlistFor(signups, desk);
  const dayAgo = new Date().getTime() - 24 * 60 * 60 * 1000;
  const unverifiedLastDay = signups.filter(
    (row) =>
      (row.sessions.includes(desk) || row.waitlist.includes(desk)) &&
      row.bot_check !== "verified" &&
      Date.parse(`${row.created_at.replace(" ", "T")}:00Z`) > dayAgo,
  ).length;
  const alert = capacityAlert({ waitlist: deskWaitlist.length, unverifiedLastDay });

  // Rows still coming to something whose WeChat value would not find anyone.
  const todayIso = new Date().toISOString().slice(0, 10);
  const suspectWechat = signups.filter(
    (row) =>
      row.wechat &&
      !looksLikeWechatId(row.wechat) &&
      [...row.sessions, ...row.waitlist].some((session) => session >= todayIso),
  );
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
    // The one tap on the signup confirmation (signup-interest.ts, 2026-10-04):
    // sizes Build Tuesday and the small class before either is announced.
    {
      label: "成功页一问：以后还想来（周二动手局 · 带着做的小班 · 都不用）",
      value: `${signups.filter((row) => row.interest === "tuesday").length} · ${signups.filter((row) => row.interest === "class").length} · ${signups.filter((row) => row.interest === "none").length}`,
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
        <h1>{view === "overview" ? "后台" : ADMIN_VIEW_LABEL[view]}</h1>
        {/* The six views, one tap each (2026-11-02). */}
        <nav className="chips" aria-label="后台分区">
          {ADMIN_VIEWS.map((item) => (
            <a key={item} className={item === view ? "chip chip--link chip--on" : "chip chip--link"} href={item === "overview" ? "/admin" : `/admin?view=${item}`}>
              {ADMIN_VIEW_LABEL[item]}
            </a>
          ))}
        </nav>
      </div>

      {/* The result of the last action, carried in the redirect. */}
      {msg && (
        <p className="alert" role="status">
          {msg.slice(0, 200)}
        </p>
      )}

      {view === "overview" && (
      <>

      {/* Today first (2026-11-02): the session in focus and the two pages a
          morning actually runs on — the desk for whoever is at the door, the
          full-screen code for the table. Numbers are the ones read above. */}
      <section className="card card--accent admin-today" aria-labelledby="admin-today">
        <h2 className="h3" id="admin-today" style={{ margin: 0 }}>
          {formatSession(desk, "zh")}{isSpecialSession(desk) ? " · Build Tuesday" : ""}
        </h2>
        <p className="body" style={{ margin: 0 }}>
          报名 {deskRow?.total ?? 0} / {capFor(desk)} · 候补 {waitlistBySession.get(desk) ?? 0} · 已签到 {deskCheckins.length}
        </p>
        <div className="admin-today__actions">
          <a className="btn btn--primary" href="/admin/today">今天</a>
          <a className="btn btn--secondary" href="/admin/desk">签到台（门口用）</a>
          <a className="btn btn--secondary" href="/admin/door">门口签到码（全屏）</a>
          <a className="btn btn--secondary" href={`/sessions/${desk}`}>当天现场页</a>
        </div>
      </section>

      {/* The team's door (2026-11-02): one address to remember instead of a
          link with a key in it. Access is per person, given on /admin/roles. */}
      <details className="card stack-2">
        <summary><strong>助理怎么进后台</strong>（每人一条专属链接，单独加、单独撤）</summary>
        <p className="body-sm" style={{ margin: "var(--space-2) 0 0" }}>
          ① 在 <a href="/admin/roles">身份与助理</a> 把这个人加为「助理」；② 把那一行下面的「专属登录链接」私发给 TA，在微信里点一次就登录了；③ 以后 TA 打开 <span className="mono">vibethursday.com/staff</span> 就直接进后台。要撤销，在同一页点「移除」，不影响其他人。
        </p>
      </details>

      {/* What is waiting on the organiser, each a link to where it is dealt
          with. Highlighted only when it needs doing. */}
      {(() => {
        const nextFee = tuesdayFees[0];
        const owing = nextFee ? nextFee.rows.filter((row) => !row.member && row.status !== "paid" && row.status !== "waived").length : 0;
        const pendingPhotos = photos.filter((p) => p.status === "pending").length;
        const drafts = progressEntries.filter((entry) => !entry.confirmed).length;
        type Tile = { href: string; n: number | null; label: string; warn: boolean };
        // Split by day (2026-11-02), like the menu: Tuesday's numbers in one
        // row, Thursday's in another, so neither has to be picked out of a mix.
        const rows: { title: string; tiles: Tile[] }[] = [
          {
            title: "周二 · Build Tuesday",
            tiles: [
              { href: "/admin/desk?day=tue", n: null, label: "周二签到台", warn: false },
              ...(nextFee ? [{ href: adminHref("tuesday-fees"), n: owing, label: `周二未付 · ${nextFee.session.slice(5)}`, warn: owing > 0 }] : []),
              { href: "/admin/members", n: memberships.filter((row) => row.active).length, label: "共创会员（在期）", warn: false },
              { href: "/admin/roles#mentor", n: personRoles.filter((row) => row.role === "mentor").length, label: "导师团 · 点这里加人", warn: false },
              { href: "/admin/roles#builder", n: personRoles.filter((row) => row.role === "builder").length, label: "共建者 · 点这里加人", warn: false },
            ],
          },
          {
            title: "周四 · Vibe Thursday",
            tiles: [
              { href: "/admin/desk?day=thu", n: null, label: "周四签到台", warn: false },
              { href: "/admin/waitlist", n: waitlistBySession.get(desk) ?? 0, label: "候补（本场）", warn: false },
              { href: "/admin/photos", n: pendingPhotos, label: "照片待审", warn: pendingPhotos > 0 },
            ],
          },
          {
            title: "两天共用",
            tiles: [{ href: "/admin/progress", n: drafts, label: "作品进展草稿", warn: drafts > 0 }],
          },
        ];
        return (
          <div className="stack-4">
            {rows.map((row) => (
              <div className="stack-2" key={row.title}>
                <h2 className="eyebrow" style={{ margin: 0 }}>{row.title}</h2>
                <nav className="admin-tiles" aria-label={row.title}>
                  {row.tiles.map((tile) => (
                    <a key={tile.href} className={tile.warn ? "admin-tile admin-tile--warn" : "admin-tile"} href={tile.href}>
                      <strong>{tile.n ?? "→"}</strong>
                      <span>{tile.label}</span>
                    </a>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        );
      })()}
      </>
      )}

      {view === "week" && (
      <section className="stack-8 admin-group" id="week">
        <h2 className="eyebrow">① 本周</h2>
      {/* ── This week at a glance ──────────────────────────────────────
          Numbers already read above; nothing new is queried for this. */}

      {/* The week's numbers are in the "today" card at the top (2026-11-02). */}

      {alert && (
        <p className="alert" role="status" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
          候补 {alert.waitlist} 人 · 24 小时内 {alert.unverifiedLastDay} 条报名没过人机验证。看一下下面的候补名单和报名明细，是不是真人。
        </p>
      )}

      {/* Waitlist and the week's questions moved to their own pages
          (2026-11-02) so an assistant can use them too. */}
      <p className="body-sm">
        <a href="/admin/waitlist">候补（{deskWaitlist.length} 人）→</a>　<a href="/admin/questions">本周问答 →</a>
      </p>

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
      )}

      {view === "after" && (
      <section className="stack-8 admin-group" id="after">
        <h2 className="eyebrow">② 散场后</h2>
        <p className="body-sm">
          <a href="/admin/tag">给这一场来的人做标注 →</a>　<a href="/admin/people">看所有人的画像</a>
        </p>
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

      {/* Photo review moved to /admin/photos (2026-11-02). */}
      <p className="body-sm">
        <a href="/admin/photos">照片审核（待审 {photos.filter((p) => p.status === "pending").length}）→</a>
      </p>
      </section>
      )}

      {view === "community" && (
      <section className="stack-8 admin-group" id="community">
        <h2 className="eyebrow">③ 社群：码头与成员卡片</h2>
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

          {/* Same question, different words or different people: keep one,
              list the rest. /wharf then shows the kept wording once with every
              asker's name. A row somebody claimed or answered is skipped. */}
          <form method="post" action="/api/admin/wharf" className="stack-2" style={{ marginBottom: "var(--space-4)" }}>
            <input type="hidden" name="action" value="merge" />
            <label className="body-sm">
              Keep #{" "}
              <input name="keep" inputMode="numeric" size={6} required />
              {" "}and merge into it #{" "}
              <input name="ids" placeholder="12 15 31" size={24} required />
            </label>
            <button className="btn btn--secondary btn--sm" type="submit">
              Merge
            </button>
          </form>

          <table className="table">
            <thead>
              <tr>
                <th>#</th>
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
                  <td className="mono">{question.id}</td>
                  <td>{question.lane}</td>
                  <td style={{ whiteSpace: "normal", maxWidth: "36ch" }}>
                    {question.text}
                    {question.merged_into && (
                      <form method="post" action="/api/admin/wharf" style={{ display: "inline" }}>
                        <input type="hidden" name="action" value="unmerge" />
                        <input type="hidden" name="id" value={question.id} />
                        {" "}
                        <button className="linkish" type="submit">
                          → #{question.merged_into} (unmerge)
                        </button>
                      </form>
                    )}
                  </td>
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

      </section>
      )}

      {view === "data" && (
      <section className="stack-8 admin-group" id="data">
        <h2 className="eyebrow">④ 数据与工具：统计、AI 用量、投屏、报名明细</h2>
      {/* WeChat IDs that do not look like one — usually a nickname typed into
          the ID box, which cannot be found in WeChat. The organiser learns the
          real ID in the group and fixes it here; the old value is kept so it
          still finds the person (`correctWechat`). Added 2026-09-28. */}
      <section className="stack-4" id="wechat-fix">
        <div className="group-head">
          <h2 className="h3">可能填成了昵称的微信号</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            {suspectWechat.length} 条 · 只列以后还有场次的
          </span>
        </div>
        {suspectWechat.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>
            没有。
          </p>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="可能填成了昵称的微信号">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">名字</th>
                  <th scope="col">填的</th>
                  <th scope="col">场次</th>
                  <th scope="col">正确的微信号</th>
                </tr>
              </thead>
              <tbody>
                {suspectWechat.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className="mono">{row.wechat}</td>
                    <td className="mono">{[...row.sessions, ...row.waitlist.map((w) => `${w}（候补）`)].join(" ")}</td>
                    <td>
                      <form method="post" action="/api/admin/wechat" style={{ display: "flex", gap: "var(--space-2)" }}>
                        <input type="hidden" name="id" value={row.id} />
                        <input className="field" name="wechat" maxLength={60} required aria-label={`${row.name} 的正确微信号`} />
                        <button className="btn btn--secondary" type="submit">
                          改
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

      {/* Two rows that are one person. Nothing here guesses which: the ids come
          from the table below (or the CSV's id column) and the organiser
          decides. The newer row folds into the older one (`mergeSignups`). */}
      <section className="stack-4" id="merge">
        <div className="group-head">
          <h2 className="h3">合并重复报名</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            同一个人报了两行时用。场次、签到、名片并到「留下」那行，另一行删除，撤不回。
          </span>
        </div>
        {/* Walk-ins (typed their name at the door) that look like an earlier
            signup. A suggestion only: same name can be two people. */}
        {walkIns.length > 0 && (
          <div className="card stack-3">
            <p className="body-sm" style={{ margin: 0 }}>
              <strong>现场写名字签到的，可能已经报过名：</strong>确认是同一个人再合并，留下的是原来那行。
            </p>
            <ul className="stack-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {walkIns.flatMap((match) =>
                match.candidates.map((candidate) => (
                  <li key={`${match.walkIn.id}-${candidate.id}`}>
                    <form method="post" action="/api/admin/merge" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
                      <input type="hidden" name="keep" value={candidate.id} />
                      <input type="hidden" name="drop" value={match.walkIn.id} />
                      <span className="body-sm">
                        现场 #{match.walkIn.id} {match.walkIn.name} → 原报名 #{candidate.id} {candidate.name}
                      </span>
                      <details className="confirm">
                        <summary className="linkish">合并</summary>
                        <button className="btn btn--secondary" type="submit">
                          确认合并
                        </button>
                      </details>
                    </form>
                  </li>
                )),
              )}
            </ul>
          </div>
        )}

        <form method="post" action="/api/admin/merge" className="stack-3" style={{ maxWidth: "28rem" }}>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
            <label className="label" htmlFor="merge-keep" style={{ margin: 0 }}>
              留下 #
            </label>
            <input className="field" id="merge-keep" name="keep" inputMode="numeric" pattern="[0-9]+" required style={{ width: "7rem" }} />
            <label className="label" htmlFor="merge-drop" style={{ margin: 0 }}>
              并掉 #
            </label>
            <input className="field" id="merge-drop" name="drop" inputMode="numeric" pattern="[0-9]+" required style={{ width: "7rem" }} />
          </div>
          <details className="confirm">
            <summary className="linkish">合并</summary>
            <button className="btn btn--secondary" type="submit">
              确认合并
            </button>
          </details>
        </form>
      </section>

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
                    {isSpecialSession(session.date) ? " · Build Tuesday" : ""}
                    {session.date === nextSession ? " ← next" : ""}
                  </td>
                  <td className="mono">
                    {session.total} / {capFor(session.date)}
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
      </section>
      )}

      {view === "week" && (
      <section className="stack-8 admin-group">
        <h2 className="eyebrow">分流、聚餐与开场分享</h2>
      {/* Build Tuesday: is it taking people off Thursday, or adding a second
          crowd? (2026-10-05). One row per Tuesday, against the Thursday two
          days later. "只报周二" is the number to watch: anyone who moved on /my
          lands there, since a move drops the Thursday. */}
      <section className="stack-4" id="split">
        <div className="group-head">
          <h2 className="h3">分流 · Build Tuesday</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            成功页一问：周二 {signups.filter((row) => row.interest === "tuesday").length} · 小班 {signups.filter((row) => row.interest === "class").length} · 都不用 {signups.filter((row) => row.interest === "none").length}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">周二</th>
                <th scope="col">报上 / 上限 · 候补</th>
                <th scope="col">只报周二</th>
                <th scope="col">两场都报</th>
                <th scope="col">老成员</th>
                <th scope="col">做东西的</th>
                <th scope="col">同周周四报上</th>
              </tr>
            </thead>
            <tbody>
              {SPECIAL_SESSIONS.map(({ date }) => tuesdaySplit(signups, date)).map((split) => (
                <tr key={split.tuesday}>
                  <td className="mono">{split.tuesday}</td>
                  <td className="mono">{split.tuesdayBooked} / {capFor(split.tuesday)} · {split.tuesdayWaitlist}</td>
                  <td className="mono">{split.tuesdayOnly}</td>
                  <td className="mono">{split.both}</td>
                  <td className="mono">{split.regulars}</td>
                  <td className="mono">{split.builders}</td>
                  <td className="mono">{split.thursdayBooked} / {SESSION_CAP} · {split.thursday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The dinner after a Thursday (2026-10-15): who has a seat, who paid.
          "Paid" is set here by hand once the transfer shows up. */}
      {dinner && (
        <section className="stack-4" id="dinner">
          <div className="group-head">
            <h2 className="h3">散场聚餐 · {formatSession(shareSession, "zh")} · {dinner.place}</h2>
            <span className="body-sm" style={{ color: "var(--fg3)" }}>
              已付 {dinnerSeats.filter((x) => x.status === "paid").length} · 待付 {dinnerSeats.filter((x) => x.status === "pending").length} · 候补 {dinnerSeats.filter((x) => x.status === "waitlist").length} · 上限 {dinner.cap}
            </span>
          </div>
          {dinnerSeats.length === 0 ? (
            <p className="body-sm" style={{ color: "var(--fg3)" }}>还没有人订聚餐。</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead><tr><th scope="col">备注编号</th><th scope="col">名字</th><th scope="col">微信号</th><th scope="col">菜式</th><th scope="col">状态</th><th scope="col">操作</th></tr></thead>
                <tbody>
                  {dinnerSeats.map((x) => (
                    <tr key={x.id}>
                      <td className="mono">{x.ref}</td>
                      <td>{x.name}</td>
                      <td className="mono">{x.wechat ?? "—"}</td>
                      <td>{dinner.dishes.find((d) => d.id === x.dish)?.zh ?? x.dish}</td>
                      <td>
                        {{ pending: "待付", paid: `已付 ${x.paid_at ?? ""}`, cancelled: "已取消", waitlist: "候补" }[x.status]}
                        {x.status === "pending" && x.claimed_at && <strong style={{ color: "var(--accent)" }}> · 说已转账 {x.claimed_at}</strong>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          {(["paid", "pending", "cancelled"] as const).filter((st) => st !== x.status).map((st) => (
                            <form method="post" action="/api/admin/dinner" key={st}>
                              <input type="hidden" name="id" value={x.id} />
                              <input type="hidden" name="status" value={st} />
                              <button className="linkish" type="submit">{{ paid: "标已付", pending: "改回待付", cancelled: "取消" }[st]}</button>
                            </form>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Thursday's opening shares (2026-10-15): pick 2–3 of the people who
          offered. The picks appear on /go for that morning, in this order. */}
      <section className="stack-4" id="shares">
        <div className="group-head">
          <h2 className="h3">本周开场分享 · {formatSession(shareSession, "zh")}</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            想分享 {shareCandidates.filter((x) => x.demo_intent === "yes").length} · 看情况 {shareCandidates.filter((x) => x.demo_intent === "maybe").length} · 已选 {shareCandidates.filter((x) => x.picked).length}（建议 2–3 人）
          </span>
        </div>
        {shareCandidates.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>还没有人报名分享。可以在群里点名老面孔。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr><th scope="col">名字</th><th scope="col">微信号</th><th scope="col">意向</th><th scope="col">分享什么</th><th scope="col">操作</th></tr>
              </thead>
              <tbody>
                {shareCandidates.map((x) => (
                  <tr key={x.signup_id}>
                    <td>{x.picked ? "✓ " : ""}{x.name}</td>
                    <td className="mono">{x.wechat ?? "—"}</td>
                    <td>{x.demo_intent === "yes" ? "想分享" : x.demo_intent === "maybe" ? "看情况" : "—"}</td>
                    <td style={{ whiteSpace: "normal", minWidth: "16em" }}>{x.share_topic ?? x.building ?? "—"}</td>
                    <td>
                      <form method="post" action="/api/admin/share">
                        <input type="hidden" name="session" value={shareSession} />
                        <input type="hidden" name="signupId" value={x.signup_id} />
                        <input type="hidden" name="pick" value={x.picked ? "0" : "1"} />
                        <button className="linkish" type="submit">{x.picked ? "取消" : "选他开场"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      </section>
      )}

      {view === "money" && (
      <section className="stack-8 admin-group" id="money">
        <h2 className="eyebrow">收款：周二、课程、会员</h2>
      {/* Build Tuesday's fee (2026-10-14): who is booked, who has paid, who
          is a member. "Paid" is set here by hand once the transfer shows up
          under their reference; members are free and need nothing. */}
      {tuesdayFees.length > 0 && (
        <section className="stack-4" id="tuesday-fees">
          {tuesdayFees.map(({ session, rows }) => {
            const owing = rows.filter((row) => !row.member && row.status !== "paid" && row.status !== "waived");
            return (
              <div className="stack-3" key={session}>
                <div className="group-head">
                  <h2 className="h3">周二收费 · {formatSession(session, "zh")}</h2>
                  <span className="body-sm" style={{ color: "var(--fg3)" }}>
                    报名 {rows.length} · 会员 {rows.filter((row) => row.member).length} · 网上已付 {rows.filter((row) => row.status === "paid" && row.paid_via === "card").length} · 手动标已付（待核） {rows.filter((row) => row.status === "paid" && row.paid_via !== "card").length} · 未付 {owing.length}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <p className="body-sm" style={{ color: "var(--fg3)" }}>还没有人报名。</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col">名字</th>
                          <th scope="col">带什么来</th>
                          <th scope="col">微信号</th>
                          <th scope="col">备注编号</th>
                          <th scope="col">状态</th>
                          <th scope="col">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.signup_id}>
                            <td>{row.name}</td>
                            {/* 2026-11-01: lines up the morning's one or two cases. */}
                            <td>
                              {{ need: "需求", project: "项目", help: "来帮忙", cert: "备考 AWS 证书" }[row.bring ?? ""] ?? "—"}
                              {(row.bring === "need" || row.bring === "project") && row.topic && <span className="body-sm" style={{ color: "var(--fg3)" }}>：{row.topic}</span>}
                            </td>
                            <td className="mono">{row.wechat ?? "—"}</td>
                            <td className="mono">{row.ref ?? "—"}</td>
                            <td>
                              {row.member
                                ? "会员/导师团，免费"
                                : row.status === "paid"
                                  ? row.paid_via === "card"
                                    ? `网上已付 ${row.paid_at ?? ""}`
                                    : <strong style={{ color: "var(--warning)" }}>手动标已付 {row.paid_at ?? ""} · 待核</strong>
                                  : row.status === "waived"
                                    ? "免收"
                                    : row.claimed_at
                                      ? <strong style={{ color: "var(--accent)" }}>说已转账 {row.claimed_at}</strong>
                                      : row.ref
                                        ? "待付"
                                        : "待付（还没打开付款页）"}
                            </td>
                            <td>
                              {!row.member && (
                                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                  {(["paid", "waived", "pending"] as const)
                                    .filter((status) => status !== (row.status ?? "pending"))
                                    .map((status) => (
                                      <form method="post" action="/api/admin/tuesday-fee" key={status}>
                                        <input type="hidden" name="session" value={session} />
                                        <input type="hidden" name="signupId" value={row.signup_id} />
                                        <input type="hidden" name="status" value={status} />
                                        <button className="linkish" type="submit">
                                          {{ paid: "标已付", waived: "免收", pending: "改回待付" }[status]}
                                        </button>
                                      </form>
                                    ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* The paid class (2026-10-12): who signed up, and whose transfer has
          arrived. Paid by bank transfer, so "paid" is set here by hand once
          the money shows up under their reference. */}
      <section className="stack-4" id="course">
        <div className="group-head">
          <h2 className="h3">{IP_COURSE.title} · {IP_COURSE.date}</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            已付 {courseOrders.filter((o) => o.status === "paid").length} · 待付 {courseOrders.filter((o) => o.status === "pending").length} · 候补 {courseOrders.filter((o) => o.status === "waitlist").length} · 上限 {IP_COURSE.cap}
          </span>
        </div>
        {courseOrders.length + oldCourseOrders.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>还没有人报名。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">备注编号</th>
                  <th scope="col">名字</th>
                  <th scope="col">微信号</th>
                  <th scope="col">状态</th>
                  <th scope="col">想让 AI 帮</th>
                  <th scope="col">行业</th>
                  <th scope="col">具体需求</th>
                  <th scope="col">报名时间</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {[...courseOrders, ...oldCourseOrders].map((order) => (
                  <tr key={order.id}>
                    <td className="mono">{order.ref}</td>
                    <td>{order.name}{order.signup_id ? "" : " ·新"}{oldCourseOrders.some((o) => o.id === order.id) ? ` ·${COURSE.title}（599）` : ""}</td>
                    <td className="mono">{order.wechat}</td>
                    <td>
                      {{ pending: "待付", paid: `已付 ${order.paid_at ?? ""}`, cancelled: "已取消", waitlist: "候补" }[order.status]}
                      {order.status === "pending" && order.claimed_at && <strong style={{ color: "var(--accent)" }}> · 说已转账 {order.claimed_at}</strong>}
                    </td>
                    <td>{order.biz_focus.join(" / ") || "—"}</td>
                    <td>{order.industry ?? "—"}</td>
                    <td style={{ minWidth: "16em", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{order.note ?? "—"}</td>
                    <td className="mono">{order.created_at}</td>
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        {(["paid", "pending", "cancelled"] as const)
                          .filter((status) => status !== order.status)
                          .map((status) => (
                            <form method="post" action="/api/admin/course" key={status}>
                              <input type="hidden" name="id" value={order.id} />
                              <input type="hidden" name="status" value={status} />
                              <button className="linkish" type="submit">
                                {{ paid: "标已付", pending: "改回待付", cancelled: "取消" }[status]}
                              </button>
                            </form>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 共创会员 bought by card (2026-11-02): the reference matches the one
          on Stripe (client reference, metadata.ref, description). */}
      <section className="stack-4" id="membership">
        <div className="group-head">
          <h2 className="h3">{MEMBERSHIP.title}（/join · 刷卡）</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            已付 {memberOrders.filter((o) => o.status === "paid").length} · 未付 {memberOrders.filter((o) => o.status === "pending").length}
          </span>
        </div>
        {memberOrders.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>还没有人买。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">付款编号</th>
                  <th scope="col">名字</th>
                  <th scope="col">微信号</th>
                  <th scope="col">状态</th>
                  <th scope="col">下单时间</th>
                </tr>
              </thead>
              <tbody>
                {memberOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono">{order.ref}</td>
                    <td>{order.name}{order.signup_id ? "" : " ·新"}</td>
                    <td className="mono">{order.wechat}</td>
                    <td>{order.status === "paid" ? `已付 ${order.paid_at ?? ""}` : order.status === "pending" ? "未付（没付完或放弃了）" : order.status}</td>
                    <td className="mono">{order.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </section>
      )}

      {view === "data" && (
      <section className="stack-8 admin-group">
      {/* How people get recognised (2026-10-11): which login is actually
          used. Counted from the day this table existed, not before. */}
      <section className="stack-4" id="logins">
        <div className="group-head">
          <h2 className="h3">登录方式 · 近 30 天</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            2026-10-11 起才开始记
          </span>
        </div>
        {logins.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>还没有记录。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">方式</th>
                  <th scope="col">次数</th>
                  <th scope="col">人数</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((row) => (
                  <tr key={row.method}>
                    <td>{LOGIN_METHOD_LABEL[row.method] ?? row.method}</td>
                    <td className="mono">{row.logins}</td>
                    <td className="mono">{row.method === "claim" ? "—" : row.people}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Who tapped "small class" on the signup confirmation (2026-10-05):
          the follow-up list. Their signup already says who they are and what
          they want, so the message can be specific — no second form anywhere. */}
      <section className="stack-4" id="class-interest">
        <div className="group-head">
          <h2 className="h3">小班意向 · {classInterest.length} 人</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            在报名表上直接报了小班课，或在成功页点了「收费小班」的人。首期定了，照这张表私信；链接 jamesai.dev/class
          </span>
        </div>
        {classInterest.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>还没有。</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">名字</th>
                  <th scope="col">微信号</th>
                  <th scope="col">哪一类</th>
                  <th scope="col">行业</th>
                  <th scope="col">想让 AI 帮</th>
                  <th scope="col">报过的场</th>
                </tr>
              </thead>
              <tbody>
                {classInterest.map((row) => {
                  const lastPurpose = row.purposes.split(" ").filter(Boolean).pop()?.split("=")[1] ?? "";
                  return (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td className="mono">{row.wechat ?? "—"}</td>
                      <td>{PURPOSE_SHORT.find((option) => option.value === lastPurpose)?.label ?? "—"}</td>
                      <td>{signupFields.industryOptions.find((option) => option.value === row.industry)?.label ?? "—"}</td>
                      <td style={{ whiteSpace: "normal", minWidth: "160px" }}>
                        {row.biz_focus.map((focus) => signupFields.bizFocusOptions.find((option) => option.value === focus)?.label ?? focus).join("、") || "—"}
                      </td>
                      <td className="mono" style={{ whiteSpace: "normal" }}>{row.sessions.join(" ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack-4" id="composition">
        <div className="group-head">
          <h2 className="h3">每场构成</h2>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            报上的人（不含候补）里，按对 AI 的熟悉程度、行业、这次想带走什么各有几个。前两题选填、
            是新加的，加之前的场次都是「未答」——未答不算任何一档。
          </span>
        </div>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">报上</th>
                <th scope="col">对 AI 多熟</th>
                <th scope="col">行业</th>
                <th scope="col">想带走什么</th>
                <th scope="col">生意想让 AI 帮</th>
              </tr>
            </thead>
            <tbody>
              {composition.map((row) => (
                <tr key={row.date}>
                  <td className="mono">{row.date}</td>
                  <td className="mono">{row.total}</td>
                  <td style={{ whiteSpace: "normal", minWidth: "180px" }}>
                    {tallyCell(row.aiLevel, signupFields.aiLevelOptions, row.unanswered.aiLevel)}
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: "240px" }}>
                    {tallyCell(row.industry, signupFields.industryOptions, row.unanswered.industry)}
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: "180px" }}>
                    {tallyCell(row.purpose, PURPOSE_SHORT, row.unanswered.purpose)}
                  </td>
                  {/* Mentions, not people (multi-select), and only business owners are asked. */}
                  <td style={{ whiteSpace: "normal", minWidth: "180px" }}>
                    {tallyCell(row.bizFocus, signupFields.bizFocusOptions, 0)}
                  </td>
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
      <form method="get" action="/admin" className="stack-2" style={{ maxWidth: "36rem" }} id="signups">
        <input type="hidden" name="view" value="data" />
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
          <a className="hl" href={all === "1" ? "/admin?view=data#signups" : "/admin?view=data&all=1#signups"}>
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
                  <td style={{ color: "var(--fg1)" }}>
                    {row.name} <span className="mono" style={{ color: "var(--fg3)" }}>#{row.id}</span>
                  </td>
                  <td>{row.email}</td>
                  <td>
                    {row.wechat ?? "—"}
                    {row.wechat_former.length > 0 && (
                      <span className="body-sm" style={{ display: "block", color: "var(--fg3)" }}>
                        曾用：{row.wechat_former.join("、")}
                      </span>
                    )}
                  </td>
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
      </section>
      )}

    </main>
  );
}
