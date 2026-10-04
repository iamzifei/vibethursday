/**
 * The one-tap question on the signup confirmation: which other kind of morning
 * someone would come to (2026-10-04).
 *
 * It exists to size two things before they are announced — Build Tuesday, and
 * a small class for people who want to be walked through it — without making
 * the signup form any longer. It is asked after the signup has gone through,
 * so not answering costs nothing.
 *
 * Kept free of `@/` imports and of `next/*` so the tests can import it directly.
 */

/**
 * The answers, in the order they are shown. Kept in step with
 * `copy.signup.fields.interestOptions`. Values are counted, so relabel freely
 * but never rename one.
 */
export const INTERESTS = ["tuesday", "class", "none"] as const;

export type Interest = (typeof INTERESTS)[number];

/** Returns the answer when it is exactly one of INTERESTS, otherwise null. */
export function parseInterest(value: unknown): Interest | null {
  if (typeof value !== "string") return null;
  return (INTERESTS as readonly string[]).includes(value) ? (value as Interest) : null;
}
