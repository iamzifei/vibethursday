// Relative imports only: the tests load this through Node's type stripper.
import { randomBytes } from "node:crypto";
import { BIZ_FOCUS, INDUSTRIES } from "./signup-profile.ts";

/**
 * The paid class (2026-10-12): one class at a time, signed up for on /class
 * and paid by bank transfer.
 *
 * Kept apart from the Thursday signup on purpose. Thursdays are free and stay
 * that way; this is a separate thing people pay for, with its own list, its
 * own cap and its own page (in the nav since 2026-10-12).
 *
 * The bank details are not in this file or anywhere in this repository: they
 * come from the COURSE_PAYMENT_INFO environment variable, and are shown only
 * after someone has signed up.
 */
export const COURSE = {
  id: "2026-10-25-ai-101",
  title: "老板的 AI 第一课",
  date: "2026-10-25",
  dateLabel: "10 月 25 日（周日）",
  timeLabel: "上午 9:00 到下午 1:00，中间有茶歇",
  placeLabel: "1/71 Chandos St, St Leonards NSW 2065",
  priceLabel: "599 澳元 + GST",
  /** What to transfer: the price plus 10% GST. */
  payLabel: "599 澳元 + GST",
  cap: 40,
} as const;

/**
 * The classes whose paid order makes someone a 共创会员 for a year (member
 * badge, Tuesdays free). Only the $599 one (James 2026-11-01): until then any
 * paid order counted, which would have made every A$365 AI+IP student a member.
 * `db.ts` reads this in every membership check.
 */
export const MEMBERSHIP_COURSES = [COURSE.id] as const;

/**
 * The class on sale on /class from 2026-11-01: the AI+IP class, one day.
 * Not a membership (see MEMBERSHIP_COURSES); members take it free, so their
 * order is confirmed without a transfer. `COURSE` above stays the 10/25 class
 * because the after-class tools (/class/kit and friends) still belong to it.
 */
export const IP_COURSE = {
  id: "2026-11-15-ai-ip",
  title: "澳洲 AI+IP 实战课",
  date: "2026-11-15",
  dateLabel: "11 月 15 日（周日）",
  timeLabel: "9:00 登记，9:30 开课，15:00 结束",
  placeLabel: "1/71 Chandos St, St Leonards NSW 2065",
  priceLabel: "365 澳元 + GST",
  /** What to transfer: A$365 plus 10% GST. */
  payLabel: "401.50 澳元（365 + GST）",
  cap: 40,
} as const;

/** A payment reference: easy to read out and type into a bank app. */
export function newCourseRef(): string {
  // No 0/O or 1/I, so it survives being read aloud or retyped.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(5);
  return `AI${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

export function looksLikeCourseRef(value: unknown): value is string {
  return typeof value === "string" && /^AI[A-HJ-NP-Z2-9]{5}$/.test(value);
}

export type CourseForm = {
  name: string | null;
  wechat: string | null;
  industry: string | null;
  bizFocus: string[];
  note: string | null;
};

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/** Reads the form, keeping only known answers for the two counted questions. */
export function parseCourseForm(get: (name: string) => unknown, getAll: (name: string) => unknown[]): CourseForm {
  const industry = clean(get("industry"), 40);
  const focus = getAll("biz_focus").filter((value): value is string => typeof value === "string");
  return {
    name: clean(get("name"), 60),
    wechat: clean(get("wechat"), 60),
    industry: industry && (INDUSTRIES as readonly string[]).includes(industry) ? industry : null,
    bizFocus: [...new Set(focus.filter((value) => (BIZ_FOCUS as readonly string[]).includes(value)))],
    note: clean(get("note"), 500),
  };
}

/** Whether one more place is left: every order that is not cancelled or waitlisted takes one. */
export function hasPlace(taken: number, cap: number = COURSE.cap): boolean {
  return taken < cap;
}
