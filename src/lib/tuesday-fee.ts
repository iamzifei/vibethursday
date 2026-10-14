// Relative imports only: the tests load this through Node's type stripper.
import { randomBytes } from "node:crypto";

/**
 * Build Tuesday's fee (James 2026-10-14).
 *
 * From 20 October a Tuesday costs $30 + GST, paid by bank transfer when you
 * sign up — everyone, presenters included: a Tuesday is a morning of
 * consulting, and the people showing their work get the most of it. Members
 * of the year-long membership come free. Thursdays stay free, and the rule
 * against charging presenters still holds there.
 *
 * The bank details are not in this file or anywhere in this repository: they
 * come from the TUESDAY_PAYMENT_INFO environment variable and are shown only
 * once someone has a reference to pay against.
 */

/** GST on the fee: the seller is registered, so it is added on top. */
export const GST_RATE = 0.1;

/** The price as listed, before GST: "30 澳元 + GST". */
export function feeLabel(fee: number, lang: "zh" | "en" = "zh"): string {
  return lang === "en" ? `A$${fee} + GST` : `${fee} 澳元 + GST`;
}

/** What to transfer, GST included: 30 → "33 澳元". */
export function feeToPay(fee: number): number {
  return Math.round(fee * (1 + GST_RATE) * 100) / 100;
}

export function payLabel(fee: number): string {
  const total = feeToPay(fee);
  return `${Number.isInteger(total) ? total : total.toFixed(2)} 澳元（含 GST）`;
}

/** A payment reference: TU plus five characters, easy to read out and retype. */
export function newFeeRef(): string {
  // No 0/O or 1/I, so it survives being read aloud or retyped. The same
  // alphabet as the class's references, under a different prefix so the two
  // can never be mistaken for each other in a bank statement.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(5);
  return `TU${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

export function looksLikeFeeRef(value: unknown): value is string {
  return typeof value === "string" && /^TU[A-HJ-NP-Z2-9]{5}$/.test(value);
}

/** The bank details, from the environment; `\n` written literally there becomes a line break. */
export function tuesdayPaymentInfo(): string {
  return process.env.TUESDAY_PAYMENT_INFO?.replace(/\\n/g, "\n").trim() ?? "";
}

/** What the signup confirmation is told about paying for a Tuesday. */
export type FeeReceipt = { member: true } | { member: false; ref: string; status: "pending" | "paid" | "waived"; amount: string };
