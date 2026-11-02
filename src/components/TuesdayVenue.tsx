import type { Lang } from "@/lib/content";
import { TUESDAY_VENUE } from "@/lib/tuesday-venue";

/**
 * Build Tuesday's address, time and directions (2026-11-02). Render this only
 * where the viewer has paid, been let in free, or is a member — see
 * `tuesday-venue.ts` for why the public pages leave the address out.
 */
export function TuesdayVenue({ lang }: { lang: Lang }) {
  const v = TUESDAY_VENUE[lang === "en" ? "en" : "zh"];
  const when = lang === "en" ? `Time: ${TUESDAY_VENUE.start}–${TUESDAY_VENUE.end}` : `时间：${TUESDAY_VENUE.start}–${TUESDAY_VENUE.end}`;
  const where = lang === "en" ? "Where: " : "地点：";
  return (
    <p className="body" style={{ margin: 0 }}>
      {when}
      <br />
      {where}
      {v.address}
      {lang === "en" ? ". " : "。"}
      {v.directions}
      <br />
      <a href={TUESDAY_VENUE.mapsUrl} target="_blank" rel="noopener noreferrer">{v.mapsLabel} ↗</a>
      {" · "}
      <a href={TUESDAY_VENUE.directionsImage} target="_blank" rel="noopener noreferrer">{v.imageLabel} ↗</a>
    </p>
  );
}
