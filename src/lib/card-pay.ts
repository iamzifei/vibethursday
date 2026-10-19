import { attachCheckout, getDinnerByRef, getSessionFeeByRef, markPaidByCard, type DinnerOrder, type SessionFee } from "./db";
import { dinnerConfig } from "./dinner";
import { feeFor, formatSession } from "./sessions";
import { CHECKOUT_HOLD_MINUTES, checkoutSettled, createCheckout, expireCheckoutPage, getCheckout, stripeEnabled, type PayKind } from "./stripe-pay";
import { feeToPay } from "./tuesday-fee";

/**
 * The server side of paying by card (2026-10-19, stripe-pay.ts): what one
 * reference costs, opening its Checkout page, and settling it when Stripe
 * says it was paid. Shared by the checkout route and both payment pages.
 */

/** What a reference costs right now, GST included, or null when it is not payable. */
export function amountFor(kind: PayKind, row: SessionFee | DinnerOrder): number | null {
  if (row.status !== "pending") return null;
  if (kind === "tuesday") {
    const fee = row as SessionFee;
    const price = feeFor(fee.session);
    return fee.booked && price !== null ? feeToPay(price) : null;
  }
  return dinnerConfig()?.price ?? null;
}

/**
 * Checks the Checkout page last opened for a row and settles it if Stripe has
 * the money — the payment page calls this when someone comes back from
 * paying, so it does not wait on the webhook. Returns true if it settled.
 */
export async function settleIfPaid(kind: PayKind, row: { ref: string; status: string; stripe_session: string | null }): Promise<boolean> {
  if (!stripeEnabled() || row.status === "paid" || !row.stripe_session) return false;
  try {
    const checkout = await getCheckout(row.stripe_session);
    if (!checkoutSettled(checkout.payment_status)) return false;
    return await markPaidByCard(kind, row.ref);
  } catch (error) {
    console.error("[pay] could not check the Checkout page", error);
    return false;
  }
}

/**
 * Where to send someone who pressed "pay by card": an open Checkout page for
 * this reference if there is one (so nobody pays twice), a new one otherwise,
 * or back to the payment page when there is nothing to pay.
 */
export async function checkoutUrlFor(ref: string, kind: PayKind, origin: string): Promise<string> {
  const back = `${origin}/${kind === "tuesday" ? "tuesday" : "dinner"}/pay?ref=${ref}`;
  const row = kind === "tuesday" ? await getSessionFeeByRef(ref) : await getDinnerByRef(ref);
  if (!row) return back;

  if (row.stripe_session) {
    const existing = await getCheckout(row.stripe_session);
    if (checkoutSettled(existing.payment_status)) {
      await markPaidByCard(kind, ref);
      return back;
    }
    // A place no longer theirs (cancelled, released) must not be payable
    // through a page opened earlier; the payment page explains instead.
    if (existing.status === "open") {
      if (amountFor(kind, row) === null) {
        await expireCheckoutPage(existing.id).catch((error) => console.error("[pay] could not close a stale Checkout page", error));
        return back;
      }
      if (existing.url) return existing.url;
    }
  }

  const amount = amountFor(kind, row);
  if (amount === null) return back;

  const when = formatSession(row.session, "zh");
  const checkout = await createCheckout({
    kind,
    ref,
    signupId: row.signup_id,
    session: row.session,
    amount,
    title: kind === "tuesday" ? `Build Tuesday · ${when}（含 GST）` : `Vibe Thursday 散场聚餐 · ${when}（含 GST）`,
    successUrl: `${back}&paid=1`,
    cancelUrl: back,
    idempotencyKey: `checkout-${ref}-${row.stripe_session ?? "first"}`,
  });
  // The hold lapsed while Stripe was answering: the place may already be
  // someone else's, so this page is closed before anyone can pay on it.
  if (!(await attachCheckout(kind, ref, checkout.id, CHECKOUT_HOLD_MINUTES))) {
    await expireCheckoutPage(checkout.id).catch((error) => console.error("[pay] could not close an orphaned Checkout page", error));
    return back;
  }
  return checkout.url ?? back;
}
