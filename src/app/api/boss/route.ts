import { NextResponse } from "next/server";
import { findMySignup, saveSignupWithResult, setOwnerLead } from "@/lib/db";
import { parseOwnerLead } from "@/lib/owner-lead";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { isTurnstileConfigured, verifyTurnstile } from "@/lib/turnstile";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

const MAX_BODY = 8 * 1024;

export const dynamic = "force-dynamic";

/**
 * The /boss form (2026-11-19, owner-lead.ts): a business owner leaves their
 * line of work and the one job they want AI to take. A plain form post that
 * answers with a 303, like /api/quick, so it works in WeChat's browser
 * without script. No session is booked.
 *
 * Someone new is saved as an ordinary signup (source "boss", no session) so
 * the person is one row everywhere on the admin, plus the owner_lead column;
 * someone already on file only gets the owner_lead column. Same guards as
 * the quick form: same-site only, Turnstile with a missing token refused,
 * rate-limited per IP, and a WeChat ID already on file under another name is
 * turned away before anything is written.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const origin = await requestOrigin();
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);
  const back = (params: Record<string, string>) => NextResponse.redirect(new URL(`/boss?${new URLSearchParams(params)}`, origin), 303);

  const ip = clientIp(request);
  if (!checkRateLimit(`boss-form:${ip}`, 20).allowed) return back({ err: "rate" });

  const input = form ? parseOwnerLead(form) : null;
  if (!input) return back({ err: "missing" });

  if (isTurnstileConfigured()) {
    const token = form?.get("turnstileToken");
    const { verdict } = await verifyTurnstile(typeof token === "string" && token ? token.slice(0, 2048) : null, ip === "unknown" ? null : ip);
    if (verdict === "rejected" || verdict === "skipped") return back({ err: "bot" });
  }

  const known = await findMySignup(input.name, input.wechat).catch(() => null);
  if (known && "nameHint" in known) return back({ err: "name", h: known.nameHint });

  try {
    // Someone already on file (same WeChat ID, same name): only the owner
    // answers are written. Going through saveSignupWithResult would rewrite
    // their row — first session, source, language — with this form's blanks
    // (review 2026-11-19).
    if (known) {
      await setOwnerLead(known.id, { ...input.lead, at: new Date().toISOString() }, input.industry);
      return back({ done: "1" });
    }

    const { id, profileUpdated } = await saveSignupWithResult({
      name: input.name,
      email: null,
      wechat: input.wechat,
      building: null,
      demoIntent: null,
      topic: null,
      firstSession: null,
      source: "boss",
      availability: [],
      aiModels: [],
      aiSpend: null,
      purpose: null,
      lang: "zh",
      botCheck: isTurnstileConfigured() ? "verified" : "unavailable",
      waitlisted: false,
    });
    // Never on somebody else's row (same rule as the full form).
    if (!profileUpdated) return back({ err: "name" });
    await setOwnerLead(id, { ...input.lead, at: new Date().toISOString() }, input.industry);
    return back({ done: "1" });
  } catch (error) {
    console.error("[boss] could not save", error);
    return back({ err: "failed" });
  }
}
