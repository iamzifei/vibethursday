/**
 * The two "who is in the room" questions on the signup form: how familiar
 * someone is with AI, and which industry they work in.
 *
 * They exist so a session can be planned around who is actually coming — a
 * room of engineers and a room of shop owners who have never opened ChatGPT
 * need different mornings, and until now the only way to tell was to guess from
 * the model / spend answers, which most business owners left blank.
 *
 * Both are optional, on the form and here. The rule this file is built around:
 * a missing, empty or unrecognised answer becomes `null` and the signup goes
 * through exactly as it did before these questions existed. A page opened
 * before the deploy sends neither field, and that must never cost a signup.
 *
 * Kept free of `@/` imports and of `next/*` so the tests can import it directly
 * (the route itself cannot be imported by the test runner).
 */

/**
 * How familiar someone is with AI, least to most. Kept in step with
 * `copy.fields.aiLevelOptions` — the stored value is what gets counted, so a
 * value must never be renamed once real answers use it.
 */
export const AI_LEVELS = ["none", "sometimes", "daily", "builder"] as const;

/**
 * Which industry someone works in. Kept in step with
 * `copy.fields.industryOptions`. Same rule as above: values are counted, so
 * relabel freely but never rename a value.
 */
export const INDUSTRIES = [
  "tech",
  "ecommerce",
  "food",
  "property",
  "finance",
  "professional",
  "education",
  "health",
  "media",
  "trade",
  "student",
  "other",
] as const;

export type AiLevel = (typeof AI_LEVELS)[number];
export type Industry = (typeof INDUSTRIES)[number];

/**
 * Returns `value` when it is exactly one of `allowed`, otherwise null.
 *
 * Whitelisted for the same reason the route whitelists every other choice:
 * these columns are only ever read back as counts, and one free-text value
 * would turn its count into a number nobody can trust.
 */
function pickOne<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T) : null;
}

/**
 * Reads the two answers out of a signup request body.
 *
 * Never throws and never rejects: anything it does not recognise — the field
 * missing, `null`, an empty string from the "skip" option, a number, a crafted
 * value — is simply "did not answer".
 */
export function parseSignupProfile(body: Record<string, unknown>): {
  aiLevel: AiLevel | null;
  industry: Industry | null;
} {
  return {
    aiLevel: pickOne(body.aiLevel, AI_LEVELS),
    industry: pickOne(body.industry, INDUSTRIES),
  };
}
