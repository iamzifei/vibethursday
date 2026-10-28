/**
 * Times in a lesson video, shared by the server and the browser player
 * (2026-10-28). No imports, so a client component can use it.
 */

/** A point in the video a learner can jump to. */
export type Chapter = { startS: number; title: string };

/** Seconds as h:mm:ss or m:ss, for a lesson's length. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
