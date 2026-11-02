/**
 * Roles the organiser hands out by hand (2026-11-02), stored in `person_roles`
 * against a signup:
 * - builder 共建者: someone from a Build Tuesday who has joined a project, on
 *   either side of it — building it, or the one who needs it built.
 * - mentor 导师团: invited by the organiser for their expertise or what they
 *   know of an industry; comes to Build Tuesday free.
 * - volunteer 志愿者 (2026-11-02): helps run the day (the desk, the door);
 *   comes to Build Tuesday free. Not shown on public cards.
 * - assistant 助理 (2026-11-02): a member of the team. Signs in at /staff with
 *   WeChat and gets the assistant's permissions (permissions.ts). Not a
 *   community identity: never on a public card, not free on Tuesdays.
 * The other identity, 共创会员, is bought (course.ts MEMBERSHIP) and is not
 * stored here.
 */

export const PERSON_ROLE_KINDS = ["builder", "mentor", "volunteer", "assistant"] as const;
export type PersonRoleKind = (typeof PERSON_ROLE_KINDS)[number];

export const ROLE_LABEL: Record<PersonRoleKind, string> = { builder: "共建者", mentor: "导师团", volunteer: "志愿者", assistant: "助理" };
export const ROLE_LABEL_EN: Record<PersonRoleKind, string> = { builder: "Builder", mentor: "Mentor", volunteer: "Volunteer", assistant: "Assistant" };

export function isRoleKind(value: unknown): value is PersonRoleKind {
  return typeof value === "string" && (PERSON_ROLE_KINDS as readonly string[]).includes(value);
}
