import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { KeepAwake } from "@/components/KeepAwake";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { isSessionDate } from "@/lib/checkin";
import { capFor } from "@/lib/capacity";
import { listDeskRows } from "@/lib/db";
import { buildDesk, deskStats, filterDesk, type DeskEntry, type PayState } from "@/lib/desk";
import { deskSession, feeFor, formatSession, isSpecialSession, nextThursdays, SPECIAL_SESSIONS, sydneyToday } from "@/lib/sessions";
import { feeLabel, payLabel } from "@/lib/tuesday-fee";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "签到台 · 后台", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<{ s?: string; q?: string; show?: string }> };

const PAY_LABEL: Record<PayState, string> = {
  free: "",
  member: "共创会员 · 免费",
  paid: "已付",
  waived: "免收",
  claimed: "说已转账 · 待核",
  owing: "未付",
  ask: "没报这一场 · 收款找主办人",
};

const BRING_LABEL: Record<string, string> = { need: "带需求", project: "带项目", help: "来帮忙" };

/**
 * The check-in desk (2026-11-02, desk.ts): one phone-sized page for whoever is
 * helping at the door on a Build Tuesday or a Thursday. For one session it
 * answers who booked, who has arrived, and who still owes the fee, and every
 * row has the button that settles it. Nothing else from /admin is on it.
 *
 * Plain forms posting to the existing admin routes, which come back here with
 * `back=desk`; no client script beyond keeping the screen awake.
 */
export default async function DeskPage({ searchParams }: PageProps) {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <div className="card stack-3">
          <h1 className="h3">没有权限</h1>
          <p className="body-sm">
            先在这台手机上打开一次主办人发你的后台链接，再回到这一页。
          </p>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const today = sydneyToday().toISOString().slice(0, 10);
  // The nearest session by default: the evening before a Tuesday that is the
  // Tuesday, though /admin's focus is still on Thursday until the day itself.
  const upcomingTuesday = SPECIAL_SESSIONS.map((item) => item.date).filter((date) => date >= today).sort()[0];
  const focus = [deskSession(), upcomingTuesday].filter(Boolean).sort()[0] as string;
  const session = params.s && isSessionDate(params.s) ? params.s : focus;
  const query = (params.q ?? "").trim().slice(0, 50);
  const show = params.show === "arrived" || params.show === "waiting" || params.show === "owing" ? params.show : "all";

  // The sessions worth switching to: the one in focus, the next Tuesday and
  // the next Thursday — so the desk can be checked the evening before.
  const choices = [...new Set([focus, deskSession(), upcomingTuesday, nextThursdays(1)[0], session].filter(Boolean) as string[])].sort();

  const fee = feeFor(session);
  const tuesday = isSpecialSession(session);
  const desk = buildDesk(await listDeskRows(session), fee !== null);
  const stats = deskStats(desk);
  const searched = filterDesk(desk, query);
  const shown = searched.filter((entry) =>
    show === "arrived" ? entry.arrived
    : show === "waiting" ? !entry.arrived
    : show === "owing" ? entry.pay === "owing" || entry.pay === "claimed"
    : true,
  );

  const href = (next: { s?: string; q?: string; show?: string }) => {
    const value = { s: session, q: query, show, ...next };
    const search = new URLSearchParams();
    search.set("s", value.s);
    if (value.q) search.set("q", value.q);
    if (value.show && value.show !== "all") search.set("show", value.show);
    return `/admin/desk?${search.toString()}`;
  };

  const Row = ({ entry }: { entry: DeskEntry }) => (
    <li className={`desk-row${entry.arrived ? " desk-row--in" : ""}`} id={`r-${entry.id}`}>
      <div className="desk-row__who">
        <strong className="desk-row__name">{entry.name}</strong>
        <span className="mono desk-row__wechat">{entry.wechat ?? "没填微信号"}</span>
        <span className="desk-row__tags">
          {entry.arrived ? (
            <span className="pill pill--live">✓ {entry.checked_in_at} 已到{entry.walkIn ? " · 现场新来" : ""}</span>
          ) : (
            <span className="pill">未到</span>
          )}
          {entry.waitlisted && !entry.booked && <span className="pill">候补</span>}
          {entry.pay !== "free" && (
            <span className={`pill${entry.pay === "owing" || entry.pay === "claimed" || entry.pay === "ask" ? " pill--warn" : " pill--live"}`}>
              {PAY_LABEL[entry.pay]}
              {entry.pay === "claimed" && entry.claimed_at ? ` ${entry.claimed_at}` : ""}
            </span>
          )}
          {tuesday && entry.bring && (
            <span className="chip">{BRING_LABEL[entry.bring] ?? entry.bring}</span>
          )}
        </span>
        {tuesday && entry.bring && entry.topic && <span className="body-sm desk-row__topic">{entry.topic}</span>}
      </div>

      <div className="desk-row__actions">
        <form method="post" action="/api/admin/checkin">
          <input type="hidden" name="session" value={session} />
          <input type="hidden" name="signupId" value={entry.id} />
          <input type="hidden" name="back" value="desk" />
          <input type="hidden" name="q" value={query} />
          <input type="hidden" name="show" value={show} />
          <input type="hidden" name="action" value={entry.arrived ? "undo" : "checkin"} />
          <button className={entry.arrived ? "btn btn--secondary btn--sm" : "btn btn--primary btn--sm"} type="submit">
            {entry.arrived ? "撤销签到" : "签到"}
          </button>
        </form>
        {(entry.pay === "owing" || entry.pay === "claimed") && (
          <>
            <Link className="btn btn--secondary btn--sm" href={`/admin/desk/pay?s=${session}&id=${entry.id}`}>付款码</Link>
            <form method="post" action="/api/admin/tuesday-fee">
              <input type="hidden" name="session" value={session} />
              <input type="hidden" name="signupId" value={entry.id} />
              <input type="hidden" name="back" value="desk" />
              <input type="hidden" name="q" value={query} />
              <input type="hidden" name="show" value={show} />
              <input type="hidden" name="status" value="paid" />
              <button className="btn btn--secondary btn--sm" type="submit">标已付</button>
            </form>
          </>
        )}
        {(entry.pay === "paid" || entry.pay === "waived") && (
          <form method="post" action="/api/admin/tuesday-fee">
            <input type="hidden" name="session" value={session} />
            <input type="hidden" name="signupId" value={entry.id} />
            <input type="hidden" name="back" value="desk" />
            <input type="hidden" name="q" value={query} />
            <input type="hidden" name="show" value={show} />
            <input type="hidden" name="status" value="pending" />
            <button className="linkish body-sm" type="submit">改回未付</button>
          </form>
        )}
      </div>
    </li>
  );

  return (
    <main className="shell section stack-6 desk">
      <KeepAwake />
      <div className="stack-3">
        <div className="tagger-top">
          <span className="eyebrow">后台 · 签到台</span>
          <span className="tagger-top__links">
            <Link href="/admin/door">门口签到码</Link>
            <Link href="/admin">回后台</Link>
          </span>
        </div>
        <h1 className="h2" style={{ margin: 0 }}>
          {formatSession(session, "zh")}
          {tuesday ? " · Build Tuesday" : ""}
        </h1>
        {session !== today && (
          <p className="alert" role="status">这不是今天的场次。签到按钮照样能用，但请确认你看的是对的那一天。</p>
        )}
        <nav className="desk-switch" aria-label="换场次">
          {choices.map((date) => (
            <Link key={date} className={date === session ? "chip chip--link chip--on" : "chip chip--link"} href={`/admin/desk?s=${date}`}>
              {formatSession(date, "zh")}{isSpecialSession(date) ? " 周二" : ""}
            </Link>
          ))}
        </nav>
      </div>

      <dl className="desk-stats">
        <div><dt>已到</dt><dd>{stats.arrived}</dd></div>
        <div><dt>未到</dt><dd>{stats.notYet}</dd></div>
        <div><dt>报名</dt><dd>{stats.booked}<span className="desk-stats__cap"> / {capFor(session)}</span></dd></div>
        <div><dt>候补</dt><dd>{stats.waitlisted}</dd></div>
        <div><dt>现场新来</dt><dd>{stats.walkIns}</dd></div>
        {fee !== null && <div className={stats.owing > 0 ? "desk-stats--warn" : ""}><dt>未付</dt><dd>{stats.owing}</dd></div>}
      </dl>

      <details className="card stack-2 desk-howto" open={stats.arrived === 0}>
        <summary><strong>怎么用（第一次看这里）</strong></summary>
        <ol className="stack-2 body-sm" style={{ margin: 0 }}>
          <li>来一个人，问名字，在下面搜名字或微信号，点<strong>「签到」</strong>。</li>
          <li>搜不到 = 没报名：请对方扫门口的签到码，选「我没报名」填三格，签完会自动出现在这里，标着「现场新来」。{fee !== null && " 没报这一场的人（现场新来、候补）门票由主办人处理，你只管签到。"}</li>
          {fee !== null && (
            <>
              <li>
                看付款：绿色（已付 / 共创会员 / 免收）不用管。<strong>黄色「未付」</strong>：门票 {feeLabel(fee)}，共 {payLabel(fee)}。点「付款码」让对方扫码刷卡，付完自动变已付；对方当场转账的，看到到账截图后点「标已付」。
              </li>
              <li>「说已转账 · 待核」= 对方在网站上点过「我已转账」，钱还没核。由主办人散场后核，现场不用追。</li>
              <li>想入共创会员的：一年周二免门票，链接是 vibethursday.com/join，让对方自己付，不用你处理。</li>
            </>
          )}
          <li>点错了：已到的人那一行有「撤销签到」。</li>
        </ol>
      </details>

      <form className="wall-search" action="/admin/desk">
        <input type="hidden" name="s" value={session} />
        {show !== "all" && <input type="hidden" name="show" value={show} />}
        <input className="field" type="search" name="q" defaultValue={query} placeholder="搜名字或微信号" autoComplete="off" />
        <button className="btn btn--secondary" type="submit">搜</button>
      </form>

      <nav className="desk-switch" aria-label="筛选">
        {([
          ["all", `全部 ${searched.length}`],
          ["waiting", `未到 ${searched.filter((entry) => !entry.arrived).length}`],
          ["arrived", `已到 ${searched.filter((entry) => entry.arrived).length}`],
          ...(fee !== null ? [["owing", `未付 ${searched.filter((entry) => entry.pay === "owing" || entry.pay === "claimed").length}`]] : []),
        ] as [string, string][]).map(([value, label]) => (
          <Link key={value} className={show === value ? "chip chip--link chip--on" : "chip chip--link"} href={href({ show: value })}>
            {label}
          </Link>
        ))}
        {query && <Link className="chip chip--link" href={href({ q: "" })}>清除搜索「{query}」</Link>}
      </nav>

      {shown.length === 0 ? (
        <p className="body" style={{ color: "var(--fg3)" }}>
          {query ? "搜不到。没报名的请对方扫门口的签到码，选「我没报名」。" : "这里还没有人。"}
        </p>
      ) : (
        <ul className="desk-list">
          {shown.map((entry) => <Row key={entry.id} entry={entry} />)}
        </ul>
      )}
    </main>
  );
}
