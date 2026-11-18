import { feeFor, isOnlineSession, isOpenTrialSession } from "./sessions.ts";

/**
 * The check-in desk (2026-11-02): who signed up for one session, who has
 * arrived, and on a paid Build Tuesday who still owes the fee — the three
 * questions whoever is helping at the door answers all morning.
 *
 * Pure, so the rules are tested without a database. `listDeskRows` in db.ts
 * reads the rows; `/admin/desk` renders them.
 *
 * The rules it encodes, all settled elsewhere and only read here:
 * - A 共创会员 never owes the Tuesday fee, whatever their fee row says.
 * - The waitlist can still come (2026-09-28): a waitlisted person is someone
 *   expected, just without a reserved seat.
 * - A walk-in is someone who checked in without having booked.
 * - Thursdays are free, so nobody owes anything on one.
 * - Only someone booked on the Tuesday can pay for it on the site: the card
 *   page refuses anyone else, and marking a fee paid books the person (past
 *   the cap). A walk-in or someone on the waitlist is "ask": the organiser
 *   settles it, not the desk.
 * - An online Tuesday (from 2026-11-10) has no fee and no door. The one
 *   question there is who may be added to that morning's WeChat group: a
 *   共创会员 or the 导师团, or anyone on an open-trial Tuesday — the same rule
 *   as `canJoinOnlineTuesday` in db.ts. Everyone else is "noAccess", pointed
 *   at /join.
 */

/**
 * What kind of session the desk is showing (2026-11-18):
 * - "free": a Thursday, nothing to collect;
 * - "paid": an in-person Tuesday with a fee (up to 2026-11-03);
 * - "online": an online Tuesday, members and mentors only;
 * - "trial": an online Tuesday open to anyone who signed up.
 */
export type DeskMode = "free" | "paid" | "online" | "trial";

/** The desk mode for a date, from the session calendar. */
export function deskModeFor(session: string): DeskMode {
  if (isOnlineSession(session)) return isOpenTrialSession(session) ? "trial" : "online";
  return feeFor(session) !== null ? "paid" : "free";
}

/** One person on the desk, as read from the database. */
export type DeskRow = {
  id: string;
  name: string;
  wechat: string | null;
  /**
   * Their WeChat group nickname, for someone who signed up through the group
   * bot (2026-11-18): those rows often have no WeChat ID, and this is the only
   * way to tell who they are.
   */
  wechat_name?: string | null;
  /** This date is in their sessions. */
  booked: boolean;
  /** This date is in their waitlist. */
  waitlisted: boolean;
  /** HH:MM Sydney time, or null if not checked in. */
  checked_in_at: string | null;
  /** qr / walk-in / admin. */
  source: string | null;
  /** A current 共创会员. */
  member: boolean;
  /** On the 导师团: free on Tuesdays (2026-11-02). */
  mentor: boolean;
  /** A 志愿者 who helps run the day: free on Tuesdays (2026-11-02). */
  volunteer: boolean;
  /** A 共建者 on some project. */
  builder: boolean;
  fee_status: "pending" | "paid" | "waived" | null;
  /** Who settled a paid fee: card (Stripe), or admin / helper by hand. */
  paid_via: "card" | "admin" | "helper" | null;
  /** When they said they had transferred, MM-DD HH:MM; null if never. */
  claimed_at: string | null;
  /** Tuesday only: need / project / help, and their one sentence. */
  bring: string | null;
  topic: string | null;
  /** What they said they were building when they signed up. */
  building: string | null;
  /** Every session they are booked on, YYYY-MM-DD — for the follow-up list. */
  sessions: string[];
};

export type PayState =
  | "free" | "member" | "mentor" | "volunteer" | "paid" | "marked" | "waived" | "claimed" | "owing" | "ask"
  // Online Tuesdays only (2026-11-18): in on an open trial, or not let in.
  | "trial" | "noAccess";

export type DeskEntry = DeskRow & {
  arrived: boolean;
  walkIn: boolean;
  pay: PayState;
};

function payState(row: DeskRow, mode: DeskMode): PayState {
  if (mode === "online" || mode === "trial") {
    // Volunteers are not let in free online: canJoinOnlineTuesday is member or mentor.
    if (row.member) return "member";
    if (row.mentor) return "mentor";
    return mode === "trial" ? "trial" : "noAccess";
  }
  if (mode === "free") return "free";
  if (row.member) return "member";
  if (row.mentor) return "mentor";
  if (row.volunteer) return "volunteer";
  if (!row.booked) return "ask";
  // Marked by hand is its own state (2026-11-02): it still needs checking
  // against a transfer, where a card payment does not.
  if (row.fee_status === "paid") return row.paid_via === "card" ? "paid" : "marked";
  if (row.fee_status === "waived") return "waived";
  if (row.claimed_at) return "claimed";
  return "owing";
}

/**
 * Everyone on the desk: not yet arrived first (by name, so the assistant can
 * scan for one), then arrived, latest first (the person in front of you is at
 * the top).
 */
export function buildDesk(rows: readonly DeskRow[], session: DeskMode | boolean): DeskEntry[] {
  // A boolean is the older "is this a paid session" form, kept for callers and tests.
  const mode: DeskMode = session === true ? "paid" : session === false ? "free" : session;
  return rows
    .map((row) => ({
      ...row,
      arrived: row.checked_in_at !== null,
      walkIn: row.checked_in_at !== null && !row.booked && !row.waitlisted,
      pay: payState(row, mode),
    }))
    .sort((a, b) => {
      if (a.arrived !== b.arrived) return a.arrived ? 1 : -1;
      if (!a.arrived) return a.name.localeCompare(b.name);
      return (b.checked_in_at ?? "").localeCompare(a.checked_in_at ?? "");
    });
}

export type DeskStats = {
  booked: number;
  waitlisted: number;
  walkIns: number;
  arrived: number;
  notYet: number;
  /** Owing or only said they paid: still to be checked. */
  owing: number;
  /** Online Tuesdays: booked but neither member nor mentor, so not added to the group. */
  noAccess: number;
  /** Online Tuesdays: booked and let in (member, mentor, or an open trial). */
  canJoin: number;
};

export function deskStats(entries: readonly DeskEntry[]): DeskStats {
  return {
    booked: entries.filter((entry) => entry.booked).length,
    waitlisted: entries.filter((entry) => entry.waitlisted && !entry.booked).length,
    walkIns: entries.filter((entry) => entry.walkIn).length,
    arrived: entries.filter((entry) => entry.arrived).length,
    notYet: entries.filter((entry) => !entry.arrived).length,
    owing: entries.filter((entry) => entry.pay === "owing" || entry.pay === "claimed").length,
    // Booked only, both of them: the online pages show "可以进群" and "不是会员"
    // side by side under "报名", and a waitlisted row is in neither.
    noAccess: entries.filter((entry) => entry.booked && entry.pay === "noAccess").length,
    canJoin: entries.filter((entry) => entry.booked && (entry.pay === "member" || entry.pay === "mentor" || entry.pay === "trial")).length,
  };
}

const squash = (text: string) => text.toLowerCase().replace(/[\s　]+/g, "");

/**
 * Narrows by name or WeChat ID, ignoring case and spaces. Empty keeps
 * everyone. `nameOnly` for the door helper: matching on the full WeChat ID
 * would let them spell out an ID the page shows shortened.
 */
export function filterDesk(entries: readonly DeskEntry[], query: string, nameOnly = false): DeskEntry[] {
  const needle = squash(query);
  if (!needle) return [...entries];
  return entries.filter((entry) => squash(`${entry.name}`).includes(needle) || (!nameOnly && squash(entry.wechat ?? "").includes(needle)));
}

const SHOWS = new Set(["arrived", "waiting", "owing"]);

/**
 * Where a desk button comes back to: the same session, search and filter,
 * scrolled to the row. Built here from checked parts only — the routes never
 * redirect to anything taken from the form as an address.
 */
export function deskReturnPath(session: string, signupId: string, q: string | null, show: string | null): string {
  const search = new URLSearchParams({ s: session });
  const query = (q ?? "").trim().slice(0, 50);
  if (query) search.set("q", query);
  if (show && SHOWS.has(show)) search.set("show", show);
  return `/admin/desk?${search.toString()}#r-${signupId}`;
}

const BRING: Record<string, string> = { need: "带需求", project: "带项目", help: "来帮忙", cert: "备考 AWS 证书" };
const SOURCE: Record<string, string> = { qr: "扫码", "walk-in": "现场新来", admin: "签到台" };
const IDENTITY: Record<PayState, string> = {
  free: "已报名",
  member: "共创会员",
  mentor: "导师团",
  volunteer: "志愿者",
  paid: "网上已付",
  marked: "手动标已付",
  waived: "免收",
  claimed: "说已转账",
  owing: "未付",
  ask: "没报这一场",
  trial: "试听",
  noAccess: "不是会员",
};

/** The after-event sheet (2026-11-02): who came, as what, and what they wrote when signing up. */
export const DESK_EXPORT_COLUMNS = ["名字", "微信号", "到场", "怎么签的", "身份", "带什么来", "这次想聊", "在做什么", "群昵称"] as const;

export function deskExportRow(entry: DeskEntry): string[] {
  const base = entry.pay === "free" && !entry.booked ? (entry.walkIn ? "现场新来" : "候补") : IDENTITY[entry.pay];
  // Roles are added to whatever they paid as: "共创会员 · 共建者".
  const identity = [base, entry.mentor && entry.pay !== "mentor" ? "导师团" : "", entry.builder ? "共建者" : ""].filter(Boolean).join(" · ");
  return [
    entry.name,
    entry.wechat ?? "",
    entry.checked_in_at ?? "没来",
    entry.source ? (SOURCE[entry.source] ?? entry.source) : "",
    identity,
    entry.bring ? (BRING[entry.bring] ?? entry.bring) : "",
    entry.topic ?? "",
    entry.building ?? "",
    // Bot signups (2026-11-18): often the only way to tell who they are.
    entry.wechat_name ?? "",
  ];
}

/**
 * What to show where a WeChat ID goes: the ID (shortened for the door helper),
 * else the group nickname of a bot signup, else a plain "none".
 */
export function wechatOrNickname(entry: Pick<DeskRow, "wechat" | "wechat_name">, full: boolean): string {
  if (entry.wechat) return (full ? entry.wechat : maskWechat(entry.wechat)) as string;
  if (entry.wechat_name) return `群里报名 · 群昵称 ${entry.wechat_name}`;
  return "没填微信号";
}

/** A WeChat ID shortened for the door helper: enough to tell two people apart, not to add them. */
export function maskWechat(wechat: string | null): string | null {
  if (!wechat) return null;
  return `${wechat.slice(0, 3)}***`;
}
