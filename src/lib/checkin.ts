// Relative, not "@/": the tests load this through Node's type stripper, which
// cannot resolve the tsconfig path alias.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checking in on the day.
 *
 * Everything in here is a pure rule with no database and no clock, so the
 * tests can walk a whole week of edge cases without touching either. The
 * routes and pages feed it rows and today's date; it answers who is on the
 * roster, who may check in, and what the wall for a session shows.
 *
 * The one piece of state is the session code — the thing in the QR on the
 * table. It is derived, not stored: an HMAC of the session date under the
 * same key that signs member cookies. Nothing to create before a session,
 * nothing to clean up after, and the code for a given Thursday is the same
 * every time it is asked for.
 */

export const CHECKIN_SOURCES = ["qr", "walk-in", "admin"] as const;
export type CheckinSource = (typeof CHECKIN_SOURCES)[number];

/** How many characters of the digest go into the QR. Ten is plenty for a
 *  code that is only valid for one calendar day and only worth a headcount. */
const CODE_LENGTH = 10;

/**
 * MEMBER_SECRET if set, otherwise ADMIN_TOKEN — the same fallback order as
 * member cookies. The label in the HMAC input keeps a session code from ever
 * verifying as a member token or the other way round.
 */
function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;

  if (!key) {
    throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; check-in is disabled");
  }

  return key;
}

/** True for a well-formed calendar date such as 2026-09-10, and nothing else. */
export function isSessionDate(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  // Reject 2026-02-31: Date.UTC rolls it into March, so the round trip differs.
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

/** The code that lets the room check in to one session. */
export function checkinCode(session: string, key: string = secret()): string {
  return createHmac("sha256", key)
    .update(`vt.checkin.v1:${session}`)
    .digest("base64url")
    .slice(0, CODE_LENGTH);
}

/** Constant-time check of a code presented for a session. */
export function verifyCheckinCode(
  session: string,
  code: string | undefined | null,
  key: string = secret(),
): boolean {
  if (!code || !isSessionDate(session)) return false;

  const a = Buffer.from(code);
  const b = Buffer.from(checkinCode(session, key));

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Whether the room may check in to `session` when the Sydney date is `today`.
 *
 * Same calendar day only. Not "within the session hours": people arrive from
 * ten, stay for lunch, and someone remembering at four in the afternoon that
 * they never tapped their name is still a real attendance. Not the day before
 * or after either — a code that works on Wednesday is a signup form, not a
 * check-in. The organiser's manual check-in in /admin is not subject to this.
 */
export function canCheckIn(session: string, today: string): boolean {
  return isSessionDate(session) && session === today;
}

/** The shape of a signup row the roster needs. */
export type RosterSignup = {
  id: string;
  name: string;
  building: string | null;
  /** ISO dates, as `listSignups` returns them. */
  sessions: string[];
};

/** The shape of a check-in row the roster needs. */
export type RosterCheckin = {
  signup_id: string;
  on_wall: boolean;
};

export type RosterEntry = {
  id: string;
  name: string;
  /**
   * A few words of "what they are building", shown only when another entry
   * has the same name. Three people called Chris have come to one session;
   * without this a button that says "Chris" is a coin toss.
   */
  hint: string | null;
  checkedIn: boolean;
  onWall: boolean;
};

/** Roughly one line on a phone. */
const HINT_LENGTH = 24;

/** Collapses whitespace and cuts to a hint's length. Null when there is nothing to show. */
export function shortHint(text: string | null | undefined): string | null {
  const collapsed = (text ?? "").split(/\s+/).join(" ").trim();
  if (!collapsed) return null;
  return collapsed.length > HINT_LENGTH ? `${collapsed.slice(0, HINT_LENGTH)}…` : collapsed;
}

/**
 * Who is on the list for a session: everyone who signed up for it, plus
 * anyone who has already checked in to it (a walk-in is not on the signup
 * list for the day until the moment they check in, and must not vanish from
 * the roster the moment they do).
 *
 * Names still to be tapped come first, in name order, so a phone in the room
 * finds itself quickly; the people already through are listed after, ticked.
 */
export function buildRoster(
  session: string,
  signups: readonly RosterSignup[],
  checkins: readonly RosterCheckin[],
): RosterEntry[] {
  const checkedIn = new Map(checkins.map((row) => [row.signup_id, row.on_wall]));

  const entries = signups
    .filter((row) => row.sessions.includes(session) || checkedIn.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name.trim(),
      building: row.building,
      checkedIn: checkedIn.has(row.id),
      onWall: checkedIn.get(row.id) ?? false,
    }));

  const nameCount = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }

  return entries
    .map(({ building, ...entry }) => ({
      ...entry,
      hint: (nameCount.get(entry.name.toLowerCase()) ?? 0) > 1 ? shortHint(building) : null,
    }))
    .sort((a, b) => {
      if (a.checkedIn !== b.checkedIn) return a.checkedIn ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

/** A check-in row joined with whatever card its person has. */
export type WallCheckin = {
  signup_id: string;
  name: string;
  building: string | null;
  on_wall: boolean;
  /** Null when this person never claimed a card. */
  member: { slug: string; published: boolean; hidden: boolean } | null;
};

export type WallEntry =
  /** A live member card; the page renders the full card by slug. Name and
   *  building ride along so the page can still show the person if the card
   *  leaves the wall between the check-in and the render. */
  | { kind: "card"; slug: string; signup_id: string; name: string; building: string | null }
  /** Someone with no live card who agreed to be named: name and what they are building. */
  | { kind: "light"; signup_id: string; name: string; building: string | null };

export type Wall = {
  entries: WallEntry[];
  /** Everyone who checked in, whether or not they are shown. */
  total: number;
  /** How many checked in but chose not to be named. */
  unnamed: number;
};

/**
 * What a session's wall shows.
 *
 * `on_wall` is the person's own answer at check-in and is the only thing
 * consulted for whether they appear. A published card is used when there is
 * one because it is already public; a draft or hidden card is not, and that
 * person gets the same light entry as someone with no card at all — a card
 * taken off the wall stays off it.
 */
export function buildWall(rows: readonly WallCheckin[]): Wall {
  const entries: WallEntry[] = [];
  let unnamed = 0;

  for (const row of rows) {
    if (!row.on_wall) {
      unnamed += 1;
      continue;
    }

    const person = { signup_id: row.signup_id, name: row.name.trim(), building: row.building };

    if (row.member && row.member.published && !row.member.hidden) {
      entries.push({ kind: "card", slug: row.member.slug, ...person });
    } else {
      entries.push({ kind: "light", ...person });
    }
  }

  return { entries, total: rows.length, unnamed };
}
