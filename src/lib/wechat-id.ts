/**
 * Whether a string can be a WeChat ID, as opposed to a nickname.
 *
 * WeChat IDs are letters, digits, `_` and `-` (a phone number also works as
 * one). Nicknames are not searchable, so a signup that leaves one cannot be
 * added to the group, and the claim lookup — which matches the value exactly —
 * becomes something the person has to reproduce character for character.
 * Real signups did exactly that: Chinese characters, a space in the middle, a
 * note like "（视频号）" appended after the ID.
 *
 * Used as a soft check only. A false alarm must never cost someone their
 * signup, so the form warns once and accepts the second submit as-is.
 */
export function looksLikeWechatId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value.trim());
}
