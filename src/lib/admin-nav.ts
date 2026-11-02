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
  {
    title: "今天",
    links: [
      { href: "/admin", label: "总览" },
      { href: "/admin/desk", label: "签到台", hint: "门口用，手机上看" },
      { href: "/admin/door", label: "门口签到码", hint: "平板全屏" },
    ],
  },
  {
    title: "本周",
    links: [
      { href: "/admin#week", label: "报名、候补、问答、海报" },
      { href: "/admin#tuesday-fees", label: "周二收费" },
      { href: "/admin#after", label: "散场后：照片、反馈" },
    ],
  },
  {
    title: "人",
    links: [
      { href: "/admin/members", label: "共创会员", hint: "名单与手动登记" },
      { href: "/admin/roles", label: "共建者与导师团", hint: "加、去身份；导师团周二免费" },
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
      { href: "/admin#community", label: "社群：码头、名片" },
    ],
  },
  {
    title: "数据与工具",
    links: [{ href: "/admin#data", label: "数据、合并、导出" }],
  },
];

/** Pages that are drawn without the admin frame: full screen on a tablet. */
export const FRAMELESS = ["/admin/door"];
