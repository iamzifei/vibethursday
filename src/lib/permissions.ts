/**
 * Who on the team may do what (2026-11-02).
 *
 * One table, so "can an assistant do X?" has a single answer, and so a test
 * can check that every /api/admin route asks this table rather than deciding
 * for itself (tests/permissions.test.mts).
 *
 * Two roles today. A third ("team member") is a new row here plus the role
 * in person-roles.ts, not a change to every route.
 *
 * Kept free of imports so the tests load it through Node's type stripper.
 */

export const STAFF_ROLES = ["admin", "assistant"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Every permission a route may ask for.
 *
 * - desk        the check-in desk, the door code and a person's payment code page
 * - checkin     tick someone in, or untick a mistake
 * - feeMarkPaid mark a Tuesday fee paid by hand (cash or transfer)
 * - wechatFull  see WeChat IDs in full rather than shortened
 * - waitlist    move someone off the waitlist
 * - questions   moderate the week's questions
 * - photos      approve or hide uploaded photos
 * - admin       everything else: money totals, waiving fees, memberships, pay
 *               links, roles, courses, content, merges, exports
 */
export const PERMISSIONS = [
  "desk",
  "checkin",
  "feeMarkPaid",
  "wechatFull",
  "waitlist",
  "questions",
  "photos",
  "admin",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * What each role holds. The admin holds everything. The assistant's set is
 * James's decision of 2026-11-02: run the day (desk, check-in, waitlist,
 * questions, photos), see full WeChat IDs, mark a Tuesday fee paid — and
 * nothing that shows amounts, waives a fee, or touches memberships and pay
 * links.
 */
const GRANTS: Record<StaffRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  assistant: ["desk", "checkin", "feeMarkPaid", "wechatFull", "waitlist", "questions", "photos"],
};

/** Whether `role` may do `permission`. Null (nobody signed in) may do nothing. */
export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return GRANTS[role].includes(permission);
}

/** Display names for the team panel. */
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = { admin: "管理员", assistant: "助理" };
