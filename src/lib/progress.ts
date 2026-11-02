// Relative, not "@/": the tests load this through Node's type stripper.
import { titleHash } from "./works.ts";

export { titleHash };

/**
 * A work's progress (2026-11-02): a dated record of how a project moved,
 * shown on its own page under /works.
 *
 * Why it exists: what a Build Tuesday produces is not a talk but a project
 * that moves a little each week. Written down, that path is evidence — for the
 * maker (a public record of having shipped, or of a third-party certificate
 * earned on the way) and for the meetup (a process others can follow and get
 * the same kind of result). Until now the site only showed where a work ended
 * up, never how it got there.
 *
 * Who writes it: the organiser, from what happened in the room, never the
 * member. Most member cards are two lines long; a field members are asked to
 * keep up would sit empty. And nothing is public until it is confirmed —
 * confirming means the maker said yes to that one line being shown.
 *
 * A record hangs off the maker's member id plus the work's title hash rather
 * than an asset id: saving a card deletes and re-inserts its assets, so ids
 * never last, while the title hash is what the work's address is made of.
 */

export const PROGRESS_KINDS = ["tuesday", "launch", "users", "revenue", "credential", "note"] as const;
export type ProgressKind = (typeof PROGRESS_KINDS)[number];

export const MAX_TITLE = 140;
export const MAX_DETAIL = 500;

/** One record, as read back from the database. Dates are plain YYYY-MM-DD. */
export type ProgressEntry = {
  id: string;
  member_id: string;
  work_hash: string;
  happened_on: string;
  kind: ProgressKind;
  title: string;
  detail: string | null;
  proof_url: string | null;
  confirmed: boolean;
};

/** What the organiser's form becomes once it has been checked. */
export type ProgressInput = {
  memberId: string;
  workHash: string;
  happenedOn: string;
  kind: ProgressKind;
  title: string;
  detail: string | null;
  proofUrl: string | null;
};

type FormFields = Partial<Record<"member" | "hash" | "date" | "kind" | "title" | "detail" | "proof", string | null>>;

/** A real calendar date, so 2026-02-31 is refused rather than rolled into March. */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

function isKind(value: string): value is ProgressKind {
  return (PROGRESS_KINDS as readonly string[]).includes(value);
}

/**
 * Checks the organiser's form. Every field is either valid or the whole entry
 * is refused with the name of the first field that is not — the form is
 * filled by one person who can simply fix it and resend.
 *
 * A proof link must be https: it is shown to strangers as "verify with the
 * issuer", so it can be neither a script nor a plain-text page.
 */
export function parseProgressForm(
  form: FormFields,
  /** Sydney's today; when given, a later date is refused (a badge must not appear early). */
  today?: string,
): { ok: true; value: ProgressInput } | { ok: false; error: string } {
  const member = (form.member ?? "").trim();
  const hash = (form.hash ?? "").trim();
  const date = (form.date ?? "").trim();
  const kind = (form.kind ?? "").trim();
  const title = (form.title ?? "").trim();
  const detail = (form.detail ?? "").trim();
  const proof = (form.proof ?? "").trim();

  // At most 18 digits: always inside a Postgres bigint.
  if (!/^\d{1,18}$/.test(member)) return { ok: false, error: "member" };
  if (!/^[0-9a-z]{6}$/.test(hash)) return { ok: false, error: "hash" };
  if (!isDate(date) || (today !== undefined && date > today)) return { ok: false, error: "date" };
  if (!isKind(kind)) return { ok: false, error: "kind" };
  if (!title || [...title].length > MAX_TITLE) return { ok: false, error: "title" };
  if ([...detail].length > MAX_DETAIL) return { ok: false, error: "detail" };

  let proofUrl: string | null = null;
  if (proof) {
    let parsed: URL;
    try {
      parsed = new URL(proof);
    } catch {
      return { ok: false, error: "proof" };
    }
    // No "user@host" form: https://issuer.com@elsewhere.example goes to elsewhere.
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return { ok: false, error: "proof" };
    proofUrl = parsed.toString();
  }
  // A certificate is worth showing only if a stranger can check it with whoever issued it.
  if (kind === "credential" && !proofUrl) return { ok: false, error: "proof" };

  return {
    ok: true,
    value: { memberId: member, workHash: hash, happenedOn: date, kind, title, detail: detail || null, proofUrl },
  };
}

/**
 * What a stranger sees: confirmed entries only, newest first. On the same day
 * the later-written entry comes first (ids only ever grow).
 */
export function publicTimeline(entries: readonly ProgressEntry[]): ProgressEntry[] {
  return entries
    .filter((entry) => entry.confirmed)
    .sort((a, b) =>
      a.happened_on === b.happened_on
        ? Number(b.id) - Number(a.id)
        : a.happened_on < b.happened_on ? 1 : -1,
    );
}

/** The most recent confirmed Build Tuesday demo, or null if there is none. */
export function lastTuesdayDemo(entries: readonly ProgressEntry[]): string | null {
  let latest: string | null = null;
  for (const entry of entries) {
    if (entry.confirmed && entry.kind === "tuesday" && (latest === null || entry.happened_on > latest)) latest = entry.happened_on;
  }
  return latest;
}

/** Groups records by "<member id>:<title hash>", the pair a work is known by here. */
export function progressByWork(entries: readonly ProgressEntry[]): Map<string, ProgressEntry[]> {
  const map = new Map<string, ProgressEntry[]>();
  for (const entry of entries) {
    const key = `${entry.member_id}:${entry.work_hash}`;
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  }
  return map;
}
