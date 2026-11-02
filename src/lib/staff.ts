import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  isAdmin,
  isAdminSession,
  readStaffToken,
  STAFF_COOKIE,
  staffSessionValid,
} from "./admin-auth.ts";
import { assistantStamp } from "./db.ts";
import { can, type Permission, type StaffRole } from "./permissions.ts";

/**
 * Who on the team is looking (2026-11-02): "admin", "assistant", or null.
 *
 * - The admin: the session cookie set by the admin link (admin-auth.ts).
 * - An assistant: the staff cookie set by their personal link (sent by the
 *   admin from /admin/roles), checked against the 助理 role on every request —
 *   so removing the role takes effect at once, for that one person.
 * - The old shared helper link was retired on 2026-11-02 (removed in code, so
 *   ADMIN_TOKEN did not need rotating).
 *
 * ⚠️ Never the ordinary sign-in (account.ts): that rests on a name and
 * a WeChat ID, which anyone in the room can see.
 */
export async function staffRole(): Promise<StaffRole | null> {
  const jar = await cookies();
  if (isAdminSession(jar.get(ADMIN_COOKIE)?.value)) return "admin";

  const pass = jar.get(STAFF_COOKIE)?.value;
  const named = readStaffToken(pass);
  if (!pass || !named) return null;
  try {
    const stamp = await assistantStamp(named.signupId);
    return stamp && staffSessionValid(pass, named.signupId, stamp) ? "assistant" : null;
  } catch (error) {
    // A database hiccup must not open anything: no answer is no access.
    console.error("[staff] could not check the assistant pass", error);
    return null;
  }
}

/**
 * The one gate every /api/admin action goes through (tests/permissions.test.mts
 * checks that each route calls it, with a named permission).
 *
 * Returns the caller's role when they hold `permission`, otherwise null — the
 * route answers 403. `key` is the admin token posted in a form by a tab opened
 * before the admin cookie existed; it only ever counts as the admin, and is
 * never read from the URL (it would end up in logs and history).
 * `request` is taken so every call site reads the same and stays greppable.
 */
export async function authorise(
  request: Request,
  permission: Permission,
  key?: string | null,
): Promise<StaffRole | null> {
  void request;
  if (isAdmin(key ?? undefined)) return "admin";

  const role = await staffRole();
  return can(role, permission) ? role : null;
}
