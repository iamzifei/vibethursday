/**
 * Every organiser page, in one list (2026-11-02): the admin sidebar and the
 * mobile menu are both drawn from it, and `tests/admin-nav.test.mts` fails if
 * a page under src/app/admin has no entry here — a page nobody can find is a
 * page that does not exist.
 *
 * Grouped by when in the week each is used. Anchors (#…) are sections of the
 * long /admin page; the rest are pages of their own.
 */

export type AdminLink = { href: string; label: string; hint?: string };
export type AdminGroup = { title: string; links: AdminLink[] };

export const ADMIN_NAV: AdminGroup[] = [
  // Split by day (2026-11-02): Tuesday and Thursday each get their own block,
  // even where both open the same page — the organiser looks for "Tuesday's
  // desk", not "the desk, then pick a date". `?day=tue|thu` makes the shared
  // pages open on that day's next session (sessions.ts `sessionForDay`).
  {
    title: "总览",
    links: [{ href: "/admin", label: "总览", hint: "今天、待办数字" }],
  },
  {
    title: "周二 · Build Tuesday",
    links: [
      { href: "/admin/desk?day=tue", label: "周二签到台", hint: "签到、看付款" },
      { href: "/admin/door?day=tue", label: "周二门口签到码", hint: "平板全屏" },
      { href: "/admin#tuesday-fees", label: "周二报名与收费" },
      { href: "/admin/followup?day=tue", label: "周二会后跟进", hint: "需求、项目、该推会员的" },
      { href: "/admin/paylinks", label: "直接付款链接", hint: "30 和 599 的链接、二维码" },
      { href: "/admin/members", label: "共创会员", hint: "名单与手动登记" },
      { href: "/admin/roles", label: "身份与助理", hint: "加助理、导师团、共建者" },
    ],
  },
  {
    title: "周四 · Vibe Thursday",
    links: [
      { href: "/admin/desk?day=thu", label: "周四签到台", hint: "门口用，手机上看" },
      { href: "/admin/door?day=thu", label: "周四门口签到码", hint: "平板全屏" },
      { href: "/admin#week", label: "周四报名、候补、问答、海报" },
      { href: "/admin#after", label: "周四散场后：照片、反馈" },
      { href: "/admin/followup?day=thu", label: "周四会后跟进" },
      { href: "/admin#community", label: "社群：码头、名片" },
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
      { href: "/admin#course", label: "课程报名" },
    ],
  },
  {
    title: "数据与工具",
    links: [{ href: "/admin#data", label: "数据、合并、导出" }],
  },
];

/** Pages that are drawn without the admin frame: full screen on a tablet. */
export const FRAMELESS = ["/admin/door"];

/** What the helper at the door can open (2026-11-02). */
export const HELPER_NAV: AdminGroup[] = [
  {
    title: "签到",
    links: [
      { href: "/admin/desk?day=tue", label: "周二签到台", hint: "签到、看付款" },
      { href: "/admin/desk?day=thu", label: "周四签到台", hint: "签到" },
      { href: "/admin/door?day=tue", label: "周二门口签到码", hint: "平板全屏" },
      { href: "/admin/door?day=thu", label: "周四门口签到码", hint: "平板全屏" },
    ],
  },
];
