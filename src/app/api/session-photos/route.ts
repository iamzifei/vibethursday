import { saveSessionPhotos } from "@/lib/db";
import { handlePhotoUpload } from "@/lib/session-photos";
import { sydneyToday } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/**
 * Upload photos from a session. Anyone may send them; nobody sees them until
 * the organiser approves them in /admin. Every rule — size, count, type, rate,
 * the review queue's ceiling — is in `handlePhotoUpload`, where the tests can
 * reach it.
 */
export async function POST(request: Request) {
  try {
    return await handlePhotoUpload(
      request,
      { save: saveSessionPhotos },
      sydneyToday().toISOString().slice(0, 10),
    );
  } catch (error) {
    console.error("[session-photos] upload failed", error);
    return Response.json({ error: "server_error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
