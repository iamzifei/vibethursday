// Relative imports only: the tests load this through Node's type stripper.

/**
 * /quick (2026-11-02): the shortest sign-up, for a link or QR code the
 * organiser sends to someone who signs up through him. A nickname and a
 * WeChat ID — the two things the door needs to recognise them — and which
 * day. A Tuesday goes straight on to card payment; a Thursday is booked.
 * Everything else the full form asks can be filled in later on /my.
 */

export type QuickDay = "tue" | "thu";

export type QuickSignup = { name: string; wechat: string; day: QuickDay };

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

/** The three fields, trimmed and bounded; null if any is missing or out of range. */
export function parseQuick(form: FormData): QuickSignup | null {
  const name = text(form, "name");
  const wechat = text(form, "wechat");
  const day = text(form, "day");
  if (!name || name.length > 60 || !wechat || wechat.length > 60) return null;
  if (day !== "tue" && day !== "thu") return null;
  return { name, wechat, day };
}

/**
 * The session a quick sign-up books: the first bookable date of that day.
 * `bookable` is `bookableSessions()` (sorted), `isTuesday` tells a Build
 * Tuesday from a Thursday. Null when there is none open.
 */
export function quickSession(day: QuickDay, bookable: readonly string[], isTuesday: (date: string) => boolean): string | null {
  return bookable.find((date) => (day === "tue" ? isTuesday(date) : !isTuesday(date))) ?? null;
}
