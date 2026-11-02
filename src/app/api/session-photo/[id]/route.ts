import { can } from "@/lib/permissions";
import { staffRole } from "@/lib/staff";
import { getSessionPhoto } from "@/lib/db";
import { servePhoto } from "@/lib/session-photos";

export const dynamic = "force-dynamic";

/**
 * One uploaded session photo. Public once approved; before that only the
 * team with the photos permission can load it (for /admin/photos), and
 * everyone else gets the same 404 as a photo that does not exist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviewer = can(await staffRole(), "photos");

  return servePhoto(id, reviewer, getSessionPhoto);
}
