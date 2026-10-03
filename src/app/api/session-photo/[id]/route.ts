import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { getSessionPhoto } from "@/lib/db";
import { servePhoto } from "@/lib/session-photos";

export const dynamic = "force-dynamic";

/**
 * One uploaded session photo. Public once approved; before that only the
 * organiser's session cookie can load it (for the review queue in /admin), and
 * everyone else gets the same 404 as a photo that does not exist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isAdmin = isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);

  return servePhoto(id, isAdmin, getSessionPhoto);
}
