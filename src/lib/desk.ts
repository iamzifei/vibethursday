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
 */

/** One person on the desk, as read from the database. */
export type DeskRow = {
  id: string;
  name: string;
  wechat: string | null;
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

export type PayState = "free" | "member" | "mentor" | "paid" | "marked" | "waived" | "claimed" | "owing" | "ask";

export type DeskEntry = DeskRow & {
  arrived: boolean;
  walkIn: boolean;
  pay: PayState;
};

function payState(row: DeskRow, paidSession: boolean): PayState {
  if (!paidSession) return "free";
  if (row.member) return "member";
  if (row.mentor) return "mentor";
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
export function buildDesk(rows: readonly DeskRow[], paidSession: boolean): DeskEntry[] {
  return rows
    .map((row) => ({
      ...row,
      arrived: row.checked_in_at !== null,
      walkIn: row.checked_in_at !== null && !row.booked && !row.waitlisted,
      pay: payState(row, paidSession),
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
};

export function deskStats(entries: readonly DeskEntry[]): DeskStats {
  return {
    booked: entries.filter((entry) => entry.booked).length,
    waitlisted: entries.filter((entry) => entry.waitlisted && !entry.booked).length,
    walkIns: entries.filter((entry) => entry.walkIn).length,
    arrived: entries.filter((entry) => entry.arrived).length,
    notYet: entries.filter((entry) => !entry.arrived).length,
    owing: entries.filter((entry) => entry.pay === "owing" || entry.pay === "claimed").length,
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
  paid: "网上已付",
  marked: "手动标已付",
  waived: "免收",
  claimed: "说已转账",
  owing: "未付",
  ask: "没报这一场",
};

/** The after-event sheet (2026-11-02): who came, as what, and what they wrote when signing up. */
export const DESK_EXPORT_COLUMNS = ["名字", "微信号", "到场", "怎么签的", "身份", "带什么来", "这次想聊", "在做什么"] as const;

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
  ];
}

/** A WeChat ID shortened for the door helper: enough to tell two people apart, not to add them. */
export function maskWechat(wechat: string | null): string | null {
  if (!wechat) return null;
  return `${wechat.slice(0, 3)}***`;
}
