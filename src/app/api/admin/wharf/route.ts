import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { deleteReply, setQuestionLane } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The two things only the organiser can do to the Wharf.
 *
 * **Moving a question between lanes** is the real mechanism behind the lane
 * split. `classifyLane` is a heuristic running on twenty sentences a week and
 * it will be wrong; a human moving two a week is more accurate than any rule
 * that could be written, and it is the reason the rule is allowed to stay
 * simple instead of growing into a model.
 *
 * **Deleting a reply** exists for one specific thing: somebody posts a
 * screenshot with more in it than they meant. There is a warning beside the
 * upload, and this is what happens when the warning does not work.
 *
 * A plain form post with a redirect, not JSON: /admin has no client JavaScript
 * and there is no reason for it to grow some.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const key = form.get("key");
  if (typeof key !== "string" || !isAdmin(key)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 401 });
  }

  const action = form.get("action");
  const id = form.get("id");

  if (typeof id !== "string" || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  if (action === "lane") {
    const lane = form.get("lane");
    if (lane !== "question" && lane !== "chat") {
      return NextResponse.json({ error: "bad_lane" }, { status: 400 });
    }
    await setQuestionLane(id, lane);
  } else if (action === "delete-reply") {
    await deleteReply(id);
  } else {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  return NextResponse.redirect(
    new URL(`/admin?key=${encodeURIComponent(key)}#wharf`, request.url),
    { status: 303 },
  );
}
