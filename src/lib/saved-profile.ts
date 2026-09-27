/**
 * The details this browser signed up with, remembered on the device.
 *
 * Shared by the signup form (a returning visitor only picks a session) and the
 * claim form (it prefills the name and contact the lookup has to match, which
 * is exactly where people were getting stuck — typing a WeChat nickname or
 * dropping part of what they had entered).
 */

/** What we remember locally so a returning attendee only picks a session. */
export type SavedProfile = { name: string; email: string; wechat: string; building: string };

export const PROFILE_KEY = "vt.profile";

/**
 * Reads the profile left by this browser's last successful signup.
 *
 * Deliberately localStorage and not an account: this form has no login, no
 * password and no payment behind it, and only a third of signups even leave an
 * email, so email is not a usable identity here. Keeping it on the device
 * means a returning regular taps twice, and nobody can look up anyone else's
 * details by guessing a WeChat ID.
 */
export function parseProfile(raw: string | null): SavedProfile | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SavedProfile>;
    if (!parsed.name || (!parsed.wechat && !parsed.email)) return null;
    return {
      name: parsed.name,
      email: parsed.email ?? "",
      wechat: parsed.wechat ?? "",
      building: parsed.building ?? "",
    };
  } catch {
    return null;
  }
}

/*
 * The saved profile, exposed as an external store.
 *
 * localStorage genuinely is external state, so `useSyncExternalStore` is the
 * tool for it rather than "read it in an effect and call setState" — that
 * version worked but cost an extra render on every mount and tripped the
 * set-state-in-effect rule. React also handles the hydration half correctly
 * here: `getServerSnapshot` is used for the server render and the first client
 * pass, so the markup matches and nothing is thrown away.
 *
 * The parsed value has to be cached, because `getSnapshot` returning a fresh
 * object every call makes React re-render forever.
 */
let cachedRaw: string | null | undefined;
let cachedProfile: SavedProfile | null = null;

export function profileSnapshot(): SavedProfile | null {
  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(PROFILE_KEY);
  } catch {
    // Private mode and locked-down browsers throw on access rather than
    // returning null; a returning visitor just sees the full form.
    raw = null;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedProfile = parseProfile(raw);
  }

  return cachedProfile;
}

const profileListeners = new Set<() => void>();

export function subscribeProfile(onChange: () => void): () => void {
  profileListeners.add(onChange);
  // `storage` only fires in *other* tabs, which is exactly the case an in-page
  // write cannot cover; same-tab writes call notifyProfile() directly.
  window.addEventListener("storage", onChange);

  return () => {
    profileListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function notifyProfile(): void {
  for (const listener of profileListeners) listener();
}
