import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/account";
import { checkoutUrlFor } from "@/lib/card-pay";
import { cohortOnSale, MEMBERSHIP, newMemberRef, parseCourseForm } from "@/lib/course";
import { createCourseOrder, getSignupProfile, isMember, isMemberWechat, reopenMembershipOrder } from "@/lib/db";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";
import { stripeEnabled } from "@/lib/stripe-pay";

const MAX_BODY = 4 * 1024;

export const dynamic = "force-dynamic";

/**
 * Buys the 共创会员 (2026-11-02, course.ts MEMBERSHIP): saves an order with
 * its own CM reference, then sends the person straight to Stripe. A plain
 * form post answered with a 303, so it works in WeChat's browser.
 *
 * Since 2026-11-05 it buys one 4-week cohort, paid once (no subscription).
 * With no upcoming cohort set (`cohortOnSale`) nothing is sold at all.
 *
 * Someone who is already a member is turned back rather than charged twice —
 * including everyone who bought the $599 class or the yearly membership.
 * The same WeChat ID twice keeps one order and one reference.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });

  const origin = await requestOrigin();
  const back = (params: Record<string, string>) => {
    const url = new URL("/join", origin);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
  };

  if (!fromThisSite(bounded, origin)) return new Response("Forbidden", { status: 403 });
  if (!checkRateLimit(`join:${clientIp(bounded)}`, 10).allowed) return back({ err: "rate" });

  // No cohort on sale: the page offers no form, so this is a stale tab.
  if (!cohortOnSale()) return back({ err: "closed" });

  const data = await bounded.formData().catch(() => null);
  if (!data) return back({ err: "missing" });
  const form = parseCourseForm((name) => data.get(name), (name) => data.getAll(name));

  let name = form.name;
  let wechat = form.wechat;
  let signupId: string | null = null;
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
      console.error("[join] could not read the recognised signup", error);
    }
  }
  if (!name || !wechat) return back({ err: "missing" });

  try {
    if ((signupId && (await isMember(signupId))) || (await isMemberWechat(wechat))) return back({ err: "member" });
    const order = await createCourseOrder({
      course: MEMBERSHIP.id,
      cap: MEMBERSHIP.cap,
      signupId,
      name,
      wechat,
      industry: null,
      bizFocus: [],
      note: null,
      ref: newMemberRef(),
    });
    // A paid row for someone who is no longer a member is an earlier cohort
    // that has ended: one row per WeChat ID, so it is reopened and paid again
    // (for the cohort on sale now) rather than showing "welcome" without a charge.
    if (order.status === "paid") await reopenMembershipOrder(order.ref);
    if (!stripeEnabled()) return back({ ref: order.ref });
    return NextResponse.redirect(await checkoutUrlFor(order.ref, "member", origin), 303);
  } catch (error) {
    console.error("[join] could not start the payment", error);
    return back({ err: "failed" });
  }
}
