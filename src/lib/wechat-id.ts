/**
 * Whether a string can be a WeChat ID, as opposed to a nickname.
 *
 * WeChat IDs are 6–20 letters, digits, `_` and `-`, starting with a letter
 * or underscore (a phone or QQ number also finds people). Nicknames are not searchable, so a signup that leaves one cannot be
 * added to the group, and the claim lookup — which matches the value exactly —
 * becomes something the person has to reproduce character for character.
 * Real signups did exactly that: Chinese characters, a space in the middle, a
 * note like "（视频号）" appended after the ID.
 *
 * Used as a soft check only. A false alarm must never cost someone their
 * signup, so the form warns once and accepts the second submit as-is.
 */
export function looksLikeWechatId(value: string): boolean {
  const trimmed = value.trim();
  // A chosen WeChat ID: 6–20 characters, starting with a letter or underscore.
  // Tightened 2026-09-28, after a five-letter English nickname sailed through
  // the old "letters and digits" rule and could not be found in WeChat.
  if (/^[A-Za-z_][A-Za-z0-9_-]{5,19}$/.test(trimmed)) return true;
  // A phone or QQ number: not an ID by WeChat's rules, but it finds the person,
  // and people have been added to the group by exactly that.
  return /^\d{5,15}$/.test(trimmed);
}
