// Relative, not "@/": the tests load this through Node's type stripper.
import { MEMBERSHIP } from "./course.ts";

/**
 * The 共创会员 register on /admin/members (2026-11-02).
 *
 * Every paid membership comes from one of three places: the 10-25 class
 * (bank transfer, marked paid by hand), /join (card, settled by Stripe), or a
 * manual entry here for someone who paid some other way and was missed — the
 * site would otherwise charge them for every Tuesday. A manual entry makes
 * someone a member for a year, so it needs a note saying how they paid.
 */

export type ManualMember = { name: string; wechat: string; paidOn: string; note: string };

type Fields = Partial<Record<"name" | "wechat" | "date" | "note", string | null>>;

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

/** Checks the manual-entry form against Sydney's `today`. */
export function parseManualMember(form: Fields, today: string): { ok: true; value: ManualMember } | { ok: false; error: string } {
  const name = (form.name ?? "").trim();
  const wechat = (form.wechat ?? "").trim();
  const date = (form.date ?? "").trim();
  const note = (form.note ?? "").trim();
  if (!name || name.length > 60) return { ok: false, error: "name" };
  if (!wechat || wechat.length > 60) return { ok: false, error: "wechat" };
  // A payment more than a year back has already run out; recording it would
  // only make a member of someone who no longer is one.
  const yearAgo = new Date(`${today}T00:00:00Z`);
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  if (!isDate(date) || date > today || date < yearAgo.toISOString().slice(0, 10)) return { ok: false, error: "date" };
  if (!note || note.length > 200) return { ok: false, error: "note" };
  return { ok: true, value: { name, wechat, paidOn: date, note } };
}

export type MembershipSource = "card" | "class" | "manual";

/** Where a paid membership order came from. */
export function membershipSource(row: { course: string; stripe_session: string | null; note: string | null }): MembershipSource {
  if (row.course !== MEMBERSHIP.id) return "class";
  if (row.stripe_session) return "card";
  return "manual";
}

export const SOURCE_LABEL: Record<MembershipSource, string> = {
  card: "刷卡（/join）",
  class: "10-25 课程（转账）",
  manual: "手动登记",
};
