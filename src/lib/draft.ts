/**
 * Local drafts for forms, so leaving a page never costs someone their typing.
 *
 * This site has several ways to walk away mid-edit that are not mistakes: the
 * editor links out to the badge and to the public version of the card, and the
 * signup form sits on a long page people scroll away from. None of those should
 * behave like a lost form.
 *
 * localStorage rather than the server: a draft is not worth a round trip, and
 * half-typed text must never reach a table other people read from.
 */

/** Every access is wrapped — private mode and locked-down browsers throw. */
export function readDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or disabled. The form still works; it just will not survive
    // a navigation, which is exactly where it was before this existed.
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do — a stale draft is recoverable, a thrown error is not.
  }
}

/** How long to wait after the last keystroke before writing. */
export const DRAFT_DEBOUNCE_MS = 400;
