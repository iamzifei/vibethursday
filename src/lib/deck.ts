import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * A deck someone is presenting in the room, and the live channel to the phones
 * following it.
 *
 * The meetup has no projector, so a demo is either three people leaning over
 * one laptop or it does not happen. This turns every phone in the room into
 * the screen: the presenter swipes, everyone else's page turns.
 *
 * Two decisions shape everything here.
 *
 * **What travels is a page number, not a picture.** The slides are uploaded
 * once and fetched by each phone on demand; the only thing broadcast while
 * presenting is one integer. That is what makes this work on a table full of
 * phones on mobile data with no wifi in the venue — a page turn is a few dozen
 * bytes, and a phone that misses one catches up by reading the number again.
 *
 * **Postgres holds the truth; this module is only the fast path.** The current
 * page is a column on the row. The listener set below exists so a turn arrives
 * in milliseconds rather than on the next poll, and a viewer that never manages
 * to hold an event-stream open still follows correctly, just a second or two
 * behind. Losing this map — a redeploy, a second instance — costs latency and
 * nothing else.
 */

/**
 * Four digits, said out loud across a café table.
 *
 * Not letters: this number gets read to the room over the noise of an espresso
 * machine, and B/P/V/E all sound alike in that room in two languages. Ten
 * thousand codes is far more than a Thursday needs — collisions are handled by
 * retrying the insert, not by making the code longer and harder to say.
 */
const CODE_LENGTH = 4;

export const DECK_CODE_PATTERN = /^\d{4}$/;

export function newDeckCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += String(randomInt(0, 10));
  return code;
}

export function isDeckCode(value: string | undefined | null): value is string {
  return typeof value === "string" && DECK_CODE_PATTERN.test(value);
}

/**
 * The key that distinguishes the presenter from the audience.
 *
 * It lives in the presenter's URL rather than a cookie, because the useful
 * shape of this is "build the deck on a laptop, then open the link on the
 * phone you will actually be holding". A cookie would tie control to one
 * browser and make that move impossible.
 *
 * The audience never sees it: what the QR code encodes is the viewer's URL,
 * which carries the room code alone.
 */
export function newPresenterKey(): string {
  return randomBytes(24).toString("hex");
}

/** Constant-time, for the same reason `isAdmin` is. */
export function keyMatches(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * Caps.
 *
 * `MAX_SLIDES` is a talk length, not a storage limit — the format this is for
 * is a handful of pages someone walks the table through, and a fifty-page deck
 * on a phone screen is a different (worse) event. `MAX_SLIDE_BYTES` is the
 * server's backstop; the browser shrinks every page well below it first.
 */
export const MAX_SLIDES = 40;
export const MAX_SLIDE_BYTES = 900_000;

/** What a viewer is told on connect and on every turn. */
export type DeckState = {
  index: number;
  slideCount: number;
  /** Cache generation, so a re-uploaded deck is not read from a stale cache. */
  rev: number;
};

type Listener = (state: DeckState) => void;

/**
 * Who is listening to which room.
 *
 * On `globalThis` for the same reason the database pool is: Next re-evaluates
 * modules on hot reload, and a fresh map per reload would leave every open
 * event-stream subscribed to a set nothing publishes to any more.
 */
const cache = globalThis as unknown as { __vibeThursdayDecks?: Map<string, Set<Listener>> };
cache.__vibeThursdayDecks ??= new Map();

export function subscribe(code: string, listener: Listener): () => void {
  const rooms = cache.__vibeThursdayDecks!;

  let listeners = rooms.get(code);
  if (!listeners) {
    listeners = new Set();
    rooms.set(code, listeners);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    // Rooms outnumber Thursdays over time; an empty set is dropped so the map
    // tracks what is happening now rather than everything that ever happened.
    if (listeners.size === 0) rooms.delete(code);
  };
}

export function publish(code: string, state: DeckState): void {
  const listeners = cache.__vibeThursdayDecks!.get(code);
  if (!listeners) return;

  for (const listener of listeners) {
    // One viewer's stream failing must not stop the turn reaching the rest of
    // the table. This is the whole room's screen; a broken pipe on one phone is
    // that phone's problem.
    try {
      listener(state);
    } catch {
      // The stream is already gone; its own cancel handler unsubscribes it.
    }
  }
}

/** How many phones are following a room right now. Shown to the presenter. */
export function listenerCount(code: string): number {
  return cache.__vibeThursdayDecks!.get(code)?.size ?? 0;
}

/**
 * Keeps an index inside a deck that may have grown or be empty.
 *
 * Slides can be added while the room is live, so the presenter's page number
 * and the deck's length are read at different moments by different requests.
 */
export function clampIndex(index: number, slideCount: number): number {
  if (!Number.isFinite(index) || slideCount <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), slideCount - 1);
}
