import { cookies } from "next/headers";
import { ADMIN_COOKIE, HELPER_COOKIE, isAdminSession, isHelperSession } from "./admin-auth";

/**
 * Who is looking at a page that both the organiser and the door helper may
 * open (2026-11-02): "admin", "helper", or null. Only the check-in desk, its
 * payment code and the door code ask this; every other admin page still
 * checks for the admin alone.
 */
export async function staffRole(): Promise<"admin" | "helper" | null> {
  const jar = await cookies();
  if (isAdminSession(jar.get(ADMIN_COOKIE)?.value)) return "admin";
  if (isHelperSession(jar.get(HELPER_COOKIE)?.value)) return "helper";
  return null;
}
