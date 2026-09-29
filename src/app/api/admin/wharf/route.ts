import { NextResponse } from "next/server";
import { bodyTooLarge, tooMany } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { requestOrigin } from "@/lib/request-origin";
import { coachAvailable, coachDraft } from "@/lib/coach";
import { deleteReply, listTriageCandidates, mergeQuestions, setQuestionLane, unmergeQuestion } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Most rows one press of the triage button may look at. */
const MAX_TRIAGE = 40;

/** Triage is a slow, paid pass; give it room past the platform default. */
export const maxDuration = 120;

/**
 * The two things only the organiser can do to the Wharf.
 *
 * **Moving a question between lanes** is the real mechanism behind the lane
 * split. `classifyLane` is a heuristic running on twenty sentences a week and
 * it will be wrong; a human moving two a week is more accurate than any rule
 * that could be written, and it is the reason the rule is allowed to stay
 * simple instead of growing into a model.
 *
 * **Running a triage pass** is the same lane move, done in bulk by the model
 * instead of by hand. It lives here rather than in the script next to it
 * because the production database is only reachable from inside the container,
 * so a script on somebody's laptop cannot touch the rows it is about. It stays
 * bounded, it skips anything anyone has acted on, and every row it moves is
 * undone by one click in the table above it.
 *
 * **Merging questions** files several people's versions of one question under
 * the one kept, so /wharf shows it once with all their names. By hand only —
 * see `mergeQuestions` — and undone per row with "unmerge".
 *
 * **Deleting a reply** exists for one specific thing: somebody posts a
 * screenshot with more in it than they meant. There is a warning beside the
 * upload, and this is what happens when the warning does not work.
 *
 * A plain form post with a redirect, not JSON: /admin has no client JavaScript
 * and there is no reason for it to grow some.
 */
export async function POST(request: Request) {
  // Refused before the body is read (2026-09-28 review: parsing first let one
  // oversized POST balloon the process). See `bodyTooLarge`.
  if (bodyTooLarge(request, 64 * 1024)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const key = form.get("key");
  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 401 });
  }

  const action = form.get("action");
  if (action === "triage") {
    if (!coachAvailable()) return NextResponse.json({ error: "no_coach" }, { status: 400 });

    // A ceiling on one press. The board holds tens of rows, not thousands, and
    // an admin button that can make an unbounded number of paid calls is a
    // slipped finger away from being expensive.
    const candidates = (await listTriageCandidates()).slice(0, MAX_TRIAGE);

    for (const row of candidates) {
      const coaching = await coachDraft(row.text);

      // No answer means no opinion, and no opinion must never move a row.
      if (!coaching || coaching.gap === "none") continue;

      await setQuestionLane(
        row.id,
        coaching.gap === "social" ? "chat" : "vague",
        coaching.ask || null,
      );
    }

    return NextResponse.redirect(
      new URL(`/admin#wharf`, await requestOrigin()),
      { status: 303 },
    );
  }

  // Merging: "these are the same question". Also carries no single id — it
  // takes the one to keep and a list — so it sits above the per-row guard too.
  if (action === "merge") {
    const keep = form.get("keep");
    const ids = String(form.get("ids") ?? "").match(/\d+/g) ?? [];
    if (typeof keep !== "string" || !/^\d+$/.test(keep.trim()) || ids.length === 0 || ids.length > 100) {
      return NextResponse.json({ error: "bad_merge" }, { status: 400 });
    }
    await mergeQuestions(keep.trim(), ids);
    return NextResponse.redirect(new URL(`/admin#wharf`, await requestOrigin()), { status: 303 });
  }

  // ⚠️ Below the triage branch on purpose: triage acts on the whole board and
  // carries no id, so this per-row guard would reject it.
  const id = form.get("id");

  if (typeof id !== "string" || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  if (action === "lane") {
    const lane = form.get("lane");
    if (lane !== "question" && lane !== "vague" && lane !== "chat") {
      return NextResponse.json({ error: "bad_lane" }, { status: 400 });
    }
    await setQuestionLane(id, lane);
  } else if (action === "unmerge") {
    await unmergeQuestion(id);
  } else if (action === "delete-reply") {
    await deleteReply(id);
  } else {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  return NextResponse.redirect(
    new URL(`/admin#wharf`, await requestOrigin()),
    { status: 303 },
  );
}
