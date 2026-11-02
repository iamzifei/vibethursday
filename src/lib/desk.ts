/**
 * The check-in desk (2026-11-02): who signed up for one session, who has
 * arrived, and on a paid Build Tuesday who still owes the fee — the three
 * questions an assistant at the door answers all morning (James: "我会在周二让
 * 小助理根据签到页来确定签到和报名情况").
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
  fee_status: "pending" | "paid" | "waived" | null;
  /** When they said they had transferred, MM-DD HH:MM; null if never. */
  claimed_at: string | null;
  /** Tuesday only: need / project / help, and their one sentence. */
  bring: string | null;
  topic: string | null;
};

export type PayState = "free" | "member" | "paid" | "waived" | "claimed" | "owing";

export type DeskEntry = DeskRow & {
  arrived: boolean;
  walkIn: boolean;
  pay: PayState;
};

function payState(row: DeskRow, paidSession: boolean): PayState {
  if (!paidSession) return "free";
  if (row.member) return "member";
  if (row.fee_status === "paid") return "paid";
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

/** Narrows by name or WeChat ID, ignoring case and spaces. Empty keeps everyone. */
export function filterDesk(entries: readonly DeskEntry[], query: string): DeskEntry[] {
  const needle = squash(query);
  if (!needle) return [...entries];
  return entries.filter((entry) => squash(`${entry.name}`).includes(needle) || squash(entry.wechat ?? "").includes(needle));
}
