import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/account";
import { COURSE, newCourseRef, parseCourseForm } from "@/lib/course";
import { createCourseOrder, getSignupProfile } from "@/lib/db";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

/** The most this route reads from a request body (see `boundedRequest`). */
const MAX_BODY = 8 * 1024;

/** Sign-ups per address per hour: a family on one phone, never a script. */
const PER_HOUR = 10;

export const dynamic = "force-dynamic";

/**
 * Signs up for the paid class (`course.ts`), as a plain form post answered
 * with a 303 to /class — works in WeChat's browser with or without script.
 *
 * Someone the site already recognises (`account.ts`) is signed up as that
 * person: their name and WeChat ID come from their signup, never from the
 * form, so they need not type them again. Everyone else types both.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });

  const origin = await requestOrigin();
  const back = (params: Record<string, string>) => {
    const url = new URL("/class", origin);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
  };

  // Another site posting this form in someone's browser would sign them up
  // as themselves (they are recognised by cookie): refuse it.
  if (!fromThisSite(bounded, origin)) return new Response("Forbidden", { status: 403 });
  if (!checkRateLimit(`course:${clientIp(bounded)}`, PER_HOUR).allowed) return back({ err: "rate" });

  const data = await bounded.formData().catch(() => null);
  if (!data) return back({ err: "missing" });
  const form = parseCourseForm((name) => data.get(name), (name) => data.getAll(name));

  let name = form.name;
  let wechat = form.wechat;
  let signupId: string | null = null;

  // Only when the page offered "recognised as X" (`self=1`): someone who
  // tapped "not me" on a shared phone signs up whoever they typed.
  const account = data.get("self") === "1" ? await currentAccount() : null;
  if (account) {
    try {
      const profile = await getSignupProfile(account.signupId);
      if (profile && profile.wechat) {
        name = profile.name;
        wechat = profile.wechat;
        signupId = account.signupId;
      }
    } catch (error) {
      console.error("[course] could not read the recognised signup", error);
    }
  }

  if (!name || !wechat) return back({ err: "missing" });

  try {
    const order = await createCourseOrder({
      course: COURSE.id,
      cap: COURSE.cap,
      signupId,
      name,
      wechat,
      industry: form.industry,
      bizFocus: form.bizFocus,
      note: form.note,
      ref: newCourseRef(),
    });
    return back({ ref: order.ref });
  } catch (error) {
    console.error("[course] could not save the sign-up", error);
    return back({ err: "failed" });
  }
}
