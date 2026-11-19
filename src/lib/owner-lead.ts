// Relative, not "@/": the tests load this through Node's type stripper.
import { INDUSTRIES, type Industry } from "./signup-profile.ts";

/**
 * Business owners (2026-11-19).
 *
 * Two ways an owner reaches the organiser without anything being sold from
 * the front of the room:
 * - the /boss form, linked from the home page's fourth way in: line of work,
 *   shop, size, the one job they want AI to take, and whether they agree to be
 *   followed up on WeChat;
 * - the "have James look at my business" tick on the Thursday feedback form.
 *
 * Even an owner who is not ready to pay leaves their trade and their need,
 * which is what the owners' morning for each trade is filled from.
 */

/** Company size bands on the form. Counted, so relabel freely, never rename. */
export const OWNER_SIZES = ["solo", "s2_5", "s6_20", "s21_plus", "multi_site"] as const;
export type OwnerSize = (typeof OWNER_SIZES)[number];

export const OWNER_SIZE_LABEL: Record<OwnerSize, string> = {
  solo: "就我自己",
  s2_5: "2–5 人",
  s6_20: "6–20 人",
  s21_plus: "21 人以上",
  multi_site: "多家店 / 多个办公室",
};

/** Short labels for a WeChat remark, in the community's fixed vocabulary. */
export const INDUSTRY_SHORT: Record<Industry, string> = {
  tech: "IT",
  ecommerce: "零售电商",
  food: "餐饮",
  property: "地产建筑装修",
  finance: "金融会计",
  professional: "法律移民咨询",
  education: "教育",
  health: "医疗美业",
  media: "媒体营销",
  trade: "外贸制造",
  student: "学生",
  other: "其他",
};

/** What is stored in `signups.owner_lead`. */
export type OwnerLeadRecord = {
  shop: string | null;
  size: OwnerSize | null;
  need: string | null;
  /** Agreed to a WeChat follow-up and an invitation to their trade's morning. */
  consent: boolean;
  /** ISO timestamp of the submission. */
  at: string;
};

export type OwnerLeadInput = {
  name: string;
  wechat: string;
  industry: Industry | null;
  lead: Omit<OwnerLeadRecord, "at">;
};

function text(form: FormData, key: string, max: number): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Reads the /boss form. Name and WeChat ID are required (there is no other
 * way to follow up); everything else is optional and anything unrecognised
 * becomes "not answered" rather than an error.
 */
export function parseOwnerLead(form: FormData): OwnerLeadInput | null {
  const name = text(form, "name", 60);
  const wechat = text(form, "wechat", 60);
  if (!name || !wechat) return null;
  const industryRaw = text(form, "industry", 20);
  const sizeRaw = text(form, "size", 20);
  return {
    name,
    wechat,
    industry: industryRaw && (INDUSTRIES as readonly string[]).includes(industryRaw) ? (industryRaw as Industry) : null,
    lead: {
      shop: text(form, "shop", 100),
      size: sizeRaw && (OWNER_SIZES as readonly string[]).includes(sizeRaw) ? (sizeRaw as OwnerSize) : null,
      need: text(form, "need", 1000),
      // Strict: a WeChat follow-up is only on an explicit tick.
      consent: form.get("consent") === "1",
    },
  };
}

/** The fields of a signup row this module reads. */
export type OwnerRow = {
  id: string;
  name: string;
  wechat: string | null;
  industry: string | null;
  topic: string | null;
  purposes: string;
  biz_focus: string[];
  owner_lead: OwnerLeadRecord | null;
  source: string | null;
  sessions: string[];
  checked_in: string[];
  created_at: string;
};

/** A business owner: used /boss, or said they came on business, or answered the owner question. */
export function isOwner(row: OwnerRow): boolean {
  return row.owner_lead !== null || /=biz\b/.test(row.purposes) || row.biz_focus.length > 0;
}

/**
 * The WeChat remark in the community's format: `名字 / 行业 / 规模 / 来源`,
 * size only when known (community rules, 2026-11-07).
 */
export function wechatRemark(row: OwnerRow): string {
  const industry = row.industry && row.industry in INDUSTRY_SHORT ? INDUSTRY_SHORT[row.industry as Industry] : "行业?";
  const size = row.owner_lead?.size ? OWNER_SIZE_LABEL[row.owner_lead.size] : null;
  const from = row.owner_lead && row.sessions.length === 0 ? "网站" : "VT";
  return [row.name, industry, size, from].filter(Boolean).join(" / ");
}

/**
 * Owners for the organiser's list, most recent first: anyone who agreed to a
 * follow-up on /boss, then everyone else who is an owner. `wantCall` holds
 * WeChat IDs (lower-cased, spaces removed) that ticked the feedback box.
 */
export function ownerList(rows: readonly OwnerRow[], wantCall: ReadonlySet<string>): (OwnerRow & { remark: string; wantsCall: boolean; consent: boolean })[] {
  const key = (value: string | null) => (value ?? "").replace(/\s+/g, "").toLowerCase();
  return rows
    .filter(isOwner)
    .map((row) => ({
      ...row,
      remark: wechatRemark(row),
      wantsCall: row.wechat ? wantCall.has(key(row.wechat)) : false,
      consent: row.owner_lead?.consent === true,
    }))
    .sort((a, b) => Number(b.wantsCall) - Number(a.wantsCall) || Number(b.consent) - Number(a.consent) || (a.created_at < b.created_at ? 1 : -1));
}

/** Normalises a WeChat ID the way `ownerList` compares them. */
export function wechatKey(value: string | null): string {
  return (value ?? "").replace(/\s+/g, "").toLowerCase();
}
