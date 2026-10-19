// Relative imports only: the tests load this through Node's type stripper.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Card payment for Build Tuesday's fee and the Thursday dinner (James 2026-10-19).
 *
 * Both used to be a bank transfer that the organiser marked paid by hand, so a
 * place counted as taken from the moment someone signed up until somebody
 * checked the bank. Now a place is held for a short while after signing up and
 * becomes theirs the moment Stripe says the card went through; a hold nobody
 * paid for is released and the place goes back on offer.
 *
 * The class (the year-long membership) is not paid this way: it stays a bank
 * transfer. Members still come to Tuesdays free — no payment is asked of them.
 *
 * Talks to Stripe's REST API with fetch rather than the SDK: two calls and one
 * signature check do not justify a dependency. Keys come from STRIPE_SECRET_KEY
 * and STRIPE_WEBHOOK_SECRET; with no secret key set, everything here is off and
 * the pages fall back to the bank transfer they had before.
 */

/** How long a new place is held for someone to pay, in minutes. */
export const HOLD_MINUTES = 30;

/**
 * How long a place given to someone off a Tuesday's waitlist is held for
 * them to pay. Longer than a signup's hold: they hear about it from the
 * organiser on WeChat, not on the page they are already looking at.
 */
export const PROMOTION_HOLD_MINUTES = 24 * 60;

/**
 * Stripe will not let a Checkout page expire sooner than 30 minutes after it
 * is created. A hold is stretched to at least this long whenever a Checkout
 * page is opened, so a page can never still take money for a place that was
 * already given away.
 */
export const CHECKOUT_MINUTES = 30;
export const CHECKOUT_HOLD_MINUTES = CHECKOUT_MINUTES + 3;

export type PayKind = "tuesday" | "dinner";

export function stripeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/** Which payment a reference belongs to, from its prefix (TU / DN). */
export function kindOfRef(ref: string): PayKind | null {
  if (/^TU[A-HJ-NP-Z2-9]{5}$/.test(ref)) return "tuesday";
  if (/^DN[A-HJ-NP-Z2-9]{5}$/.test(ref)) return "dinner";
  return null;
}

/** Whole minutes left on a hold, never negative; null when there is no hold. */
export function minutesLeft(holdUntil: Date | null, now: Date = new Date()): number | null {
  if (!holdUntil) return null;
  return Math.max(0, Math.ceil((holdUntil.getTime() - now.getTime()) / 60_000));
}

/** Dollars to cents without float drift: 33 → 3300, 32.99 → 3299. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Checks a webhook's Stripe-Signature header (`t=…,v1=…`): an HMAC-SHA256 of
 * `${t}.${body}` with the endpoint's secret, no older than `toleranceSeconds`.
 * Any v1 may match — Stripe sends several while a secret is being rolled.
 */
export function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim().split("=", 2) as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k, v]) => k === "v1" && v).map(([, v]) => v);
  if (!Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** The parts of a Checkout Session this site reads. */
export type CheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  metadata: Record<string, string>;
};

async function stripeRequest(path: string, init: { method: "GET" | "POST"; form?: URLSearchParams; idempotencyKey?: string }): Promise<unknown> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.form?.toString(),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(`Stripe ${path}: ${response.status} ${data?.error?.message ?? ""}`);
  return data;
}

/**
 * Opens a Checkout page for one payment. The reference, kind and who it is
 * for travel in metadata, so the webhook can settle it even if the row it was
 * opened from has since changed.
 */
export async function createCheckout(input: {
  kind: PayKind;
  ref: string;
  signupId: string;
  session: string;
  amount: number;
  title: string;
  successUrl: string;
  cancelUrl: string;
  /**
   * The same key for the same moment of the same payment — two taps on "pay"
   * at once get one Checkout page from Stripe, not two that could both be paid.
   */
  idempotencyKey: string;
}): Promise<CheckoutSession> {
  const form = new URLSearchParams({
    mode: "payment",
    locale: "auto",
    client_reference_id: input.ref,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // A margin over Stripe's 30-minute minimum, so a clock a little behind
    // Stripe's does not get every page refused.
    expires_at: String(Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60 + 90),
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "aud",
    "line_items[0][price_data][unit_amount]": String(toCents(input.amount)),
    "line_items[0][price_data][product_data][name]": input.title,
    "payment_intent_data[description]": `${input.title} · ${input.ref}`,
    "metadata[ref]": input.ref,
    "metadata[kind]": input.kind,
    "metadata[signup_id]": input.signupId,
    "metadata[session]": input.session,
    "payment_intent_data[metadata][ref]": input.ref,
  });
  return (await stripeRequest("checkout/sessions", { method: "POST", form, idempotencyKey: input.idempotencyKey })) as CheckoutSession;
}

/** Whether a Checkout page has settled: paid, or brought to zero by a promotion code. */
export function checkoutSettled(paymentStatus: string | undefined): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

/**
 * Whether `code` is an active 100%-off promotion code on the Stripe account
 * (2026-10-19). Stripe refuses a Checkout page whose total is zero, so a free
 * place is settled on this site instead — but the code itself is created,
 * limited and switched off in Stripe, which stays the one place to manage it.
 */
export async function isFullDiscountCode(code: string): Promise<boolean> {
  const data = (await stripeRequest(`promotion_codes?active=true&limit=1&code=${encodeURIComponent(code)}`, { method: "GET" })) as {
    data?: { active: boolean; expires_at: number | null; max_redemptions: number | null; times_redeemed: number; coupon?: { percent_off: number | null; valid: boolean }; promotion?: { coupon?: { percent_off: number | null; valid: boolean } | string } }[];
  };
  const promo = data.data?.[0];
  if (!promo || !promo.active) return false;
  if (promo.expires_at && promo.expires_at * 1000 < Date.now()) return false;
  const coupon = promo.coupon ?? (typeof promo.promotion?.coupon === "object" ? promo.promotion.coupon : undefined);
  return Boolean(coupon && coupon.valid && coupon.percent_off === 100);
}

/** Closes a Checkout page so it can no longer take money. */
export async function expireCheckoutPage(id: string): Promise<void> {
  await stripeRequest(`checkout/sessions/${encodeURIComponent(id)}/expire`, { method: "POST", form: new URLSearchParams() });
}

export async function getCheckout(id: string): Promise<CheckoutSession> {
  return (await stripeRequest(`checkout/sessions/${encodeURIComponent(id)}`, { method: "GET" })) as CheckoutSession;
}
