import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { deleteHandout, ossConfigured, putHandout, videoInfo, vodConfigured } from "@/lib/aliyun";
import {
  addComment,
  addLessonFile,
  createInvite,
  deleteLesson,
  deleteLessonFile,
  getLesson,
  preapproveEmail,
  revokeInvite,
  revokeInviteLearners,
  saveLesson,
  setCommentHidden,
  setLearnerName,
  setLearnerStatus,
} from "@/lib/learn-db";
import {
  CHAPTERS_TEXT_MAX,
  cleanText,
  COMMENT_MAX,
  handoutKey,
  HANDOUT_MAX_BYTES,
  HANDOUT_TYPES,
  isLearnerStatus,
  looksLikeLessonSlug,
  looksLikeVideoId,
  NAME_MAX,
  newInviteToken,
  normaliseEmail,
} from "@/lib/learn";
import { boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

export const dynamic = "force-dynamic";

/** A handout plus the form fields around it. */
const MAX_BODY = HANDOUT_MAX_BYTES + 64 * 1024;

const id = (value: FormDataEntryValue | null | undefined): string | null =>
  typeof value === "string" && /^\d{1,18}$/.test(value) ? value : null;

/**
 * Every organiser action on /admin/learn, as one form post with an `action`
 * field, answered with a 303 back to the page and a short result in the query.
 */
export async function POST(request: Request) {
  const origin = await requestOrigin();
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });
  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  // Check the organiser before reading the body: otherwise anyone could make
  // the server buffer and parse a 50 MB upload just to be told no.
  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value)) return new Response("Not authorised", { status: 403 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);

  const back = (result: string, anchor = "") =>
    NextResponse.redirect(new URL(`/admin/learn?r=${encodeURIComponent(result)}${anchor}`, origin), 303);

  const action = form?.get("action");

  try {
    switch (action) {
      case "save-lesson": {
        const slug = String(form?.get("slug") ?? "").trim();
        const title = cleanText(form?.get("title"), 120);
        if (!looksLikeLessonSlug(slug) || !title) return back("err-lesson");
        const rawVideo = String(form?.get("videoId") ?? "").trim();
        if (rawVideo && !looksLikeVideoId(rawVideo)) return back("err-video");
        const videoId = rawVideo || null;

        let durationS: number | null = null;
        if (videoId && vodConfigured()) {
          // Confirms the id exists, and reads its length for the list.
          try {
            durationS = (await videoInfo(videoId)).durationS;
          } catch {
            return back("err-video-missing");
          }
        }

        const lessonId = await saveLesson(id(form?.get("id")), {
          slug,
          title,
          summary: cleanText(form?.get("summary"), 2000),
          chapters: cleanText(form?.get("chapters"), CHAPTERS_TEXT_MAX),
          position: Number.parseInt(String(form?.get("position") ?? "0"), 10) || 0,
          videoId,
          durationS,
          published: form?.get("published") === "on",
        });
        return back("saved", `#lesson-${lessonId}`);
      }

      case "delete-lesson": {
        const lessonId = id(form?.get("id"));
        if (!lessonId || form?.get("confirm") !== "on") return back("err-confirm");
        await deleteLesson(lessonId);
        return back("deleted");
      }

      case "upload-file": {
        const lessonId = id(form?.get("lessonId"));
        const file = form?.get("file");
        const lesson = lessonId ? await getLesson(lessonId) : null;
        if (!lesson || !(file instanceof File) || file.size === 0) return back("err-file");
        if (!ossConfigured()) return back("err-oss");
        const ext = HANDOUT_TYPES[file.type];
        if (!ext || file.size > HANDOUT_MAX_BYTES) return back("err-file-type");
        const title = cleanText(form?.get("title"), 120) ?? file.name.replace(/\.[^.]+$/, "").slice(0, 120);
        const key = handoutKey(lesson.id, randomBytes(12).toString("hex"), ext);
        await putHandout(key, Buffer.from(await file.arrayBuffer()), file.type);
        await addLessonFile(lesson.id, title || "handout", key, ext, file.size);
        return back("uploaded", `#lesson-${lesson.id}`);
      }

      case "delete-file": {
        const fileId = id(form?.get("id"));
        if (!fileId) return back("err-file");
        const key = await deleteLessonFile(fileId);
        if (key && ossConfigured()) await deleteHandout(key).catch((error) => console.error("[admin/learn] orphaned handout", error));
        return back("deleted");
      }

      case "learner-status": {
        const learnerId = id(form?.get("id"));
        const status = form?.get("status");
        if (!learnerId || !isLearnerStatus(status)) return back("err-learner");
        await setLearnerStatus(learnerId, status);
        return back("saved", "#learners");
      }

      case "learner-name": {
        const learnerId = id(form?.get("id"));
        if (!learnerId) return back("err-learner");
        await setLearnerName(learnerId, cleanText(form?.get("name"), NAME_MAX));
        return back("saved", "#learners");
      }

      case "preapprove": {
        // One per line: an email, optionally followed by a name.
        const lines = String(form?.get("list") ?? "").split(/\r?\n/).slice(0, 500);
        let added = 0;
        for (const line of lines) {
          const [first, ...rest] = line.trim().split(/[\s,，]+/);
          const email = normaliseEmail(first);
          if (!email) continue;
          await preapproveEmail(email, cleanText(rest.join(" "), NAME_MAX));
          added += 1;
        }
        return back(`added-${added}`, "#learners");
      }

      case "invite-create": {
        const label = cleanText(form?.get("label"), 60);
        // Blank means no limit; anything else must be a positive whole number.
        const whole = (name: string, max: number): number | null | undefined => {
          const raw = String(form?.get(name) ?? "").trim();
          if (!raw) return null;
          const n = Number(raw);
          return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
        };
        const days = whole("days", 365);
        const maxUses = whole("maxUses", 10000);
        if (!label || days === undefined || maxUses === undefined) return back("err-invite", "#invites");
        await createInvite(newInviteToken(), label, maxUses, days);
        return back("invite-created", "#invites");
      }

      case "invite-revoke": {
        const inviteId = id(form?.get("id"));
        if (!inviteId) return back("err-invite", "#invites");
        await revokeInvite(inviteId);
        return back("invite-revoked", "#invites");
      }

      case "invite-kick": {
        const inviteId = id(form?.get("id"));
        if (!inviteId || form?.get("confirm") !== "on") return back("err-confirm", "#invites");
        // A leaked link: close the link first, so nobody new gets in through it
        // while (or after) the people already in are turned away.
        await revokeInvite(inviteId);
        return back(`kicked-${await revokeInviteLearners(inviteId)}`, "#invites");
      }

      case "comment-hide":
      case "comment-show": {
        const commentId = id(form?.get("id"));
        if (!commentId) return back("err-comment");
        await setCommentHidden(commentId, action === "comment-hide");
        return back("saved", "#comments");
      }

      case "reply": {
        const lessonId = id(form?.get("lessonId"));
        const body = cleanText(form?.get("body"), COMMENT_MAX);
        if (!lessonId || !body) return back("err-comment");
        await addComment({ lessonId, learnerId: null, byAdmin: true, parentId: id(form?.get("parent")), body });
        return back("saved", "#comments");
      }

      default:
        return back("err-action");
    }
  } catch (error) {
    console.error("[admin/learn] failed", action, error);
    return back("err-server");
  }
}
