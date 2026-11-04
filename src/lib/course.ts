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
  priceLabel: "599 澳元",
  /** What to transfer: the price plus 10% GST. */
  payLabel: "658.90 澳元（599 + GST）",
  cap: 40,
} as const;

/**
 * The yearly 共创会员 sold on /join from 2026-11-02 to 2026-11-05: A$599 + GST
 * for a year of free Build Tuesdays and one AI+IP class, as a Stripe
 * subscription renewed every year.
 *
 * No longer sold, but its orders keep exactly what they were sold with: a
 * year from payment (renewals included, see `renewMembership` in db.ts),
 * Tuesdays free and the AI+IP class free. Kept under its original id so not
 * one existing row has to change.
 */
export const YEARLY_MEMBERSHIP_ID = "vt-cocreator";

/**
 * The 共创会员 as sold from 2026-11-05: A$599 + GST, paid once by card on
 * /join (no subscription, nothing renews), for one cohort of four Build
 * Tuesdays (`MEMBERSHIP_COHORTS`). Four weeks is enough to build one product.
 * Unlike the yearly one it does NOT include the AI+IP class, which is a
 * separate product.
 *
 * ★ Why a new id rather than a payment-date cutoff: every rule about the old
 * orders (a year from payment, the free class, yearly renewals) can then stay
 * exactly as it was, keyed on the old ids, and a row says by itself which
 * deal it was bought under — nobody has to remember the date of the switch.
 *
 * Stored as a `course_orders` row like a class, so every membership check
 * reads one table. References start CM (`newMemberRef`) so card payment can
 * tell them from a class's bank-transfer reference.
 */
export const MEMBERSHIP = {
  id: "vt-cocreator-4w",
  title: "Vibe Thursday 共创会员",
  /** Before GST, in Australian dollars. */
  price: 599,
  /** What the card is charged, once: A$599 plus 10% GST. */
  amount: 658.9,
  priceLabel: "599 澳元",
  payLabel: "658.90 澳元（599 + GST）",
  /** Build Tuesdays in one cohort. */
  weeks: 4,
  /** No real cap: high enough that a membership is never waitlisted. */
  cap: 100000,
} as const;

/**
 * The Sydney date the 4-week membership went on sale. Only a manual entry on
 * /admin/members reads it, to record a payment made outside the site under
 * the deal that was on sale that day (orders made on /join carry their id).
 */
export const MEMBERSHIP_4W_FROM = "2026-11-05";

/**
 * The cohorts a 4-week membership can belong to, in date order. Add the next
 * one here once its dates are set; until then /join says the next cohort's
 * date is still to be decided and takes no payment.
 */
export type Cohort = { number: number; tuesdays: readonly string[] };
export const MEMBERSHIP_COHORTS: readonly Cohort[] = [
  { number: 1, tuesdays: ["2026-11-10", "2026-11-17", "2026-11-24", "2026-12-01"] },
];

/**
 * Orders that make someone a 共创会员 for a year (member badge, Tuesdays free,
 * the AI+IP class free): the $599 class of 10/25 and the yearly membership.
 * Never the A$365 AI+IP class (James 2026-11-01).
 */
export const YEARLY_MEMBERSHIP_COURSES = [COURSE.id, YEARLY_MEMBERSHIP_ID] as const;

/**
 * Every order that makes a 共创会员 at all: the yearly ones and the 4-week
 * one. How long each counts differs — see `membershipValidUntil`.
 */
export const MEMBERSHIP_COURSES = [...YEARLY_MEMBERSHIP_COURSES, MEMBERSHIP.id] as const;

const SYDNEY = "Australia/Sydney";

/**
 * Midnight at the start of a Sydney calendar day, as an instant. Sydney's
 * offset changes with daylight saving, so it is read from Intl for that day
 * rather than assumed. (Sydney's DST changes happen at 2–3am, never at
 * midnight, so the offset at UTC midnight is the offset at Sydney midnight
 * on every date this is used for.)
 */
function sydneyMidnight(isoDate: string): Date {
  const utcMidnight = Date.parse(`${isoDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(utcMidnight));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  // What a Sydney clock reads at UTC midnight, minus UTC midnight, is the offset.
  const offset = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - utcMidnight;
  return new Date(utcMidnight - offset);
}

/** The day after a date, YYYY-MM-DD. */
function nextDay(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

function lastTuesday(cohort: Cohort): string {
  return cohort.tuesdays[cohort.tuesdays.length - 1];
}

/** When a cohort's membership stops counting: the end of its last Tuesday, Sydney time. */
export function cohortEnd(cohort: Cohort): Date {
  return sydneyMidnight(nextDay(lastTuesday(cohort)));
}

/**
 * The cohort a 4-week payment belongs to: the first one that had not yet
 * ended when it was paid. Buying any time before cohort 1 ends joins cohort 1.
 * Null when every listed cohort was over.
 */
export function cohortForPayment(paidAt: Date): Cohort | null {
  return MEMBERSHIP_COHORTS.find((cohort) => paidAt.getTime() < cohortEnd(cohort).getTime()) ?? null;
}

/**
 * The cohort /join is selling right now: the first whose last Tuesday has not
 * yet finished (12:00 Sydney, when the online session ends). Null when no
 * upcoming cohort is set — /join then says so and takes no payment.
 */
export function cohortOnSale(now: Date = new Date()): Cohort | null {
  return (
    MEMBERSHIP_COHORTS.find((cohort) => now.getTime() < sydneyMidnight(lastTuesday(cohort)).getTime() + 12 * 60 * 60 * 1000) ?? null
  );
}

/**
 * Until when a paid order keeps someone a member, or null if it never makes
 * one. Yearly orders: a year and a week from payment, exactly as before
 * 2026-11-05 (the week is grace for a late yearly renewal). 4-week orders: the
 * end of their cohort's last Tuesday. db.ts uses the same rule in SQL
 * (`MEMBER_ACTIVE_SQL`); the tests check the two agree.
 */
export function membershipValidUntil(course: string, paidAt: Date): Date | null {
  if ((YEARLY_MEMBERSHIP_COURSES as readonly string[]).includes(course)) {
    const until = new Date(paidAt);
    until.setUTCFullYear(until.getUTCFullYear() + 1);
    until.setUTCDate(until.getUTCDate() + 7);
    return until;
  }
  if (course === MEMBERSHIP.id) {
    const cohort = cohortForPayment(paidAt);
    return cohort ? cohortEnd(cohort) : null;
  }
  return null;
}

/** Whether a membership order includes one free AI+IP class: only the yearly ones. */
export function includesIpClass(course: string): boolean {
  return (YEARLY_MEMBERSHIP_COURSES as readonly string[]).includes(course);
}

/**
 * `cohortEnd(cohortForPayment(paidAt))` as a Postgres expression, for the SQL
 * membership checks: `CASE WHEN paid < end1 THEN end1 WHEN … END`, which is
 * NULL once past the last cohort (and NULL never counts as a member).
 * `paidAt` is an SQL expression such as `o.paid_at`. Built from the
 * constants above only — never from input.
 */
export function cohortValidUntilSql(paidAt: string): string {
  const ends = MEMBERSHIP_COHORTS.map((cohort) => `'${nextDay(lastTuesday(cohort))} 00:00 ${SYDNEY}'::timestamptz`);
  if (ends.length === 0) return "NULL::timestamptz";
  return `CASE ${ends.map((end) => `WHEN ${paidAt} < ${end} THEN ${end}`).join(" ")} END`;
}

/** A cohort's dates for people: "11 月 10 日、17 日、24 日和 12 月 1 日" / "10, 17, 24 Nov and 1 Dec". */
export function cohortDatesLabel(cohort: Cohort, lang: "zh" | "en" = "zh"): string {
  const parts = cohort.tuesdays.map((iso) => {
    const [, month, day] = iso.split("-").map(Number);
    return { month, day };
  });
  const sameMonthAsPrevious = (i: number) => i > 0 && parts[i - 1].month === parts[i].month;
  if (lang === "en") {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const names = parts.map((p) => `${p.day} ${months[p.month - 1]}`);
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  const names = parts.map((p, i) => (sameMonthAsPrevious(i) ? `${p.day} 日` : `${p.month} 月 ${p.day} 日`));
  return `${names.slice(0, -1).join("、")}和 ${names[names.length - 1]}`;
}

/**
 * The class on sale on /class from 2026-11-01: the AI+IP class, one day.
 * Not a membership (see MEMBERSHIP_COURSES); yearly members take it free
 * (`includesIpClass`), so their order is confirmed without a transfer. `COURSE` above stays the 10/25 class
 * because the after-class tools (/class/kit and friends) still belong to it.
 */
export const IP_COURSE = {
  id: "2026-11-15-ai-ip",
  title: "澳洲 AI+IP 实战课",
  date: "2026-11-15",
  dateLabel: "11 月 15 日（周日）",
  timeLabel: "9:00 登记，9:30 开课，15:00 结束",
  placeLabel: "1/71 Chandos St, St Leonards NSW 2065",
  priceLabel: "365 澳元",
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

/** A membership reference: like a class's, but CM, so it is paid by card. */
export function newMemberRef(): string {
  return `CM${newCourseRef().slice(2)}`;
}

export function looksLikeMemberRef(value: unknown): value is string {
  return typeof value === "string" && /^CM[A-HJ-NP-Z2-9]{5}$/.test(value);
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
