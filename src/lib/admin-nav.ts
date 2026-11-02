/**
 * Every organiser page, in one list (2026-11-02): the admin sidebar and the
 * mobile menu are both drawn from it, and `tests/admin-nav.test.mts` fails if
 * a page under src/app/admin has no entry here — a page nobody can find is a
 * page that does not exist.
 *
 * Grouped by when in the week each is used. Anchors (#…) are sections of the
 * long /admin page; the rest are pages of their own.
 */

// Relative, not "@/": the tests load this through Node's type stripper.
import { can, type Permission, type StaffRole } from "./permissions.ts";

/**
 * `perm` is what the page checks (permissions.ts); absent means "admin". The
 * menu each person sees is filtered by it (`navFor`), so an assistant is never
 * shown a link that would only answer "no access".
 */
export type AdminLink = { href: string; label: string; hint?: string; perm?: Permission };
export type AdminGroup = { title: string; links: AdminLink[] };

export const ADMIN_NAV: AdminGroup[] = [
  // Split by day (2026-11-02): Tuesday and Thursday each get their own block,
  // even where both open the same page — the organiser looks for "Tuesday's
  // desk", not "the desk, then pick a date". `?day=tue|thu` makes the shared
  // pages open on that day's next session (sessions.ts `sessionForDay`).
  {
    title: "今天",
    links: [
      { href: "/admin/today", label: "今天", hint: "这一场的数字和常用按钮", perm: "desk" },
      { href: "/admin", label: "管理员后台", hint: "总览、本周、收款、社群、数据" },
    ],
  },
  {
    title: "周二 · Build Tuesday",
    links: [
      { href: "/admin/desk?day=tue", label: "周二签到台", hint: "签到、看付款", perm: "desk" },
      { href: "/admin/door?day=tue", label: "周二门口签到码", hint: "平板全屏", perm: "desk" },
      { href: "/admin?view=money#tuesday-fees", label: "周二收费" },
      { href: "/admin/followup?day=tue", label: "周二会后跟进", hint: "需求、项目、该推会员的" },
      { href: "/admin/paylinks", label: "直接付款链接", hint: "30 和 599 的链接、二维码" },
      { href: "/admin/members", label: "共创会员", hint: "名单与手动登记" },
      { href: "/admin/roles", label: "身份与助理", hint: "加助理、导师团、共建者" },
    ],
  },
  {
    title: "周四 · Vibe Thursday",
    links: [
      { href: "/admin/desk?day=thu", label: "周四签到台", hint: "门口用，手机上看", perm: "desk" },
      { href: "/admin/door?day=thu", label: "周四门口签到码", hint: "平板全屏", perm: "desk" },
      { href: "/admin/waitlist", label: "候补", hint: "有空位时放人", perm: "waitlist" },
      { href: "/admin/questions", label: "本周问答", hint: "群里投票选出的问题", perm: "questions" },
      { href: "/admin?view=week", label: "本周：签到名单、海报、分享、聚餐" },
      { href: "/admin/photos", label: "照片审核", hint: "大家上传的现场照片", perm: "photos" },
      { href: "/admin?view=after", label: "周四散场后：反馈" },
      { href: "/admin/followup?day=thu", label: "周四会后跟进" },
      { href: "/admin?view=community", label: "社群：码头、名片" },
    ],
  },
  {
    title: "两天共用",
    links: [
      { href: "/live", label: "投屏：今日在场", hint: "签到一个上墙一个" },
      { href: "/screen", label: "投屏：场地大屏", hint: "周二周四自动切换" },
      { href: "/admin/tag", label: "标注来的人" },
      { href: "/admin/people", label: "所有人画像" },
    ],
  },
  {
    title: "内容与课程",
    links: [
      { href: "/admin/progress", label: "作品进展" },
      { href: "/admin/learn", label: "录播课" },
      { href: "/admin?view=money", label: "收款：周二、课程、会员" },
    ],
  },
  {
    title: "数据与工具",
    links: [{ href: "/admin?view=data", label: "数据、合并、导出" }],
  },
];

/** Pages that are drawn without the admin frame: full screen on a tablet. */
export const FRAMELESS = ["/admin/door"];

/** The menu one person sees: every link their role may open, empty groups dropped. */
export function navFor(role: StaffRole): AdminGroup[] {
  return ADMIN_NAV.map((group) => ({ ...group, links: group.links.filter((link) => can(role, link.perm ?? "admin")) })).filter(
    (group) => group.links.length > 0,
  );
}

/**
 * The phone's bottom tab bar (2026-11-02): the four things a session morning
 * runs on, the same for the admin and the assistant. "更多" has no page; it
 * opens the full menu.
 */
export type AdminTab = { label: string; href: string | null; perm?: Permission; match: string[] };
export const ADMIN_TABS: AdminTab[] = [
  { label: "今天", href: "/admin/today", perm: "desk", match: ["/admin/today"] },
  { label: "签到", href: "/admin/desk", perm: "desk", match: ["/admin/desk"] },
  { label: "候补", href: "/admin/waitlist", perm: "waitlist", match: ["/admin/waitlist"] },
  { label: "更多", href: null, match: [] },
];

/**
 * The admin overview split into views (2026-11-02): one page that used to be
 * ~1,700 lines on a phone, now shown a task at a time — `/admin?view=money`.
 * "overview" (no `view`) is the short landing page.
 */
export const ADMIN_VIEWS = ["overview", "week", "after", "money", "community", "data"] as const;
export type AdminView = (typeof ADMIN_VIEWS)[number];

export const ADMIN_VIEW_LABEL: Record<AdminView, string> = {
  overview: "总览",
  week: "本周",
  after: "散场后",
  money: "收款",
  community: "社群",
  data: "数据与工具",
};

/** Which view holds each section anchor on /admin. */
const VIEW_OF: Record<string, AdminView> = {
  week: "week", checkin: "week", split: "week", dinner: "week", shares: "week",
  after: "after", feedback: "after",
  money: "money", "tuesday-fees": "money", course: "money", membership: "money",
  community: "community", wharf: "community", members: "community",
  data: "data", "wechat-fix": "data", merge: "data", sessions: "data", logins: "data",
  "class-interest": "data", composition: "data", deck: "data", signups: "data",
};

/** Reads `?view=`; anything unknown is the overview. */
export function adminView(value: string | undefined): AdminView {
  return (ADMIN_VIEWS as readonly string[]).includes(value ?? "") ? (value as AdminView) : "overview";
}

/**
 * The address of a section on /admin, in its view: `adminHref("course")` →
 * "/admin?view=money#course". Every redirect back to /admin goes through this,
 * so an action never lands on a view that does not show what it just changed.
 */
export function adminHref(anchor: string, params: Record<string, string> = {}): string {
  const view = VIEW_OF[anchor];
  if (!view) throw new Error(`unknown /admin section: ${anchor}`);
  const search = new URLSearchParams({ view, ...params });
  return `/admin?${search.toString()}#${anchor}`;
}
