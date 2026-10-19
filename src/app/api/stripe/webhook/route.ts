import { expireCheckout, markPaidByCard } from "@/lib/db";
import { bodyTooLarge, boundedRequest } from "@/lib/rate-limit";
import { verifyStripeSignature, type CheckoutSession, type PayKind } from "@/lib/stripe-pay";

const MAX_BODY = 512 * 1024;

export const dynamic = "force-dynamic";

/**
 * Stripe's word that a card payment went through, or that a Checkout page
 * expired unpaid (2026-10-19). The first settles the place; the second gives
 * it back straight away instead of at the end of its hold.
 *
 * Only Checkout pages this site opened carry `metadata.kind`; anything else on
 * the account is acknowledged and ignored. Answers 2xx for every verified
 * event it does not need, so Stripe does not keep retrying it.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const body = await request.text();
  if (!verifyStripeSignature(body, request.headers.get("stripe-signature"), secret)) {
    return new Response("Bad signature", { status: 400 });
  }

  let event: { type?: string; data?: { object?: CheckoutSession } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad body", { status: 400 });
  }

  const session = event.data?.object;
  const kind = session?.metadata?.kind as PayKind | undefined;
  const ref = session?.metadata?.ref;
  if (!session || (kind !== "tuesday" && kind !== "dinner") || !ref) return new Response("ignored");

  try {
    if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && session.payment_status === "paid") {
      await markPaidByCard(kind, ref);
    } else if (event.type === "checkout.session.expired") {
      await expireCheckout(kind, session.id);
    }
  } catch (error) {
    // A 500 makes Stripe retry later, which is what a database hiccup needs.
    console.error("[stripe] could not apply", event.type, ref, error);
    return new Response("Retry", { status: 500 });
  }
  return new Response("ok");
}
