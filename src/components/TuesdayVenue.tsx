import type { Lang } from "@/lib/content";
import { isOnlineSession } from "@/lib/sessions";
import { TUESDAY_ONLINE, TUESDAY_VENUE } from "@/lib/tuesday-venue";

/**
 * Build Tuesday's address, time and walking-directions map (2026-11-02).
 * Render this only where the viewer has paid, been let in free, or is a
 * member — see `tuesday-venue.ts` for why public pages leave it out.
 *
 * For an online Tuesday (from 2026-11-10, `isOnlineSession`) it shows the
 * time and how to get in instead: there is no address, and no link either —
 * the Zoom link is posted in a WeChat group James sets up before each one.
 * Callers show it only to people who may join (a 共创会员 or the 导师团).
 * Without a `session` it is the room, as before.
 */
export function TuesdayVenue({ lang, session }: { lang: Lang; session?: string }) {
  const en = lang === "en";
  if (session && isOnlineSession(session)) {
    const o = TUESDAY_ONLINE[en ? "en" : "zh"];
    return (
      <p className="body" style={{ margin: 0 }}>
        {en ? "Time: " : "时间："}
        {TUESDAY_ONLINE.start}–{TUESDAY_ONLINE.end}
        {en ? " (Sydney)" : "（悉尼时间）"}
        <br />
        {en ? "Where: " : "地点："}
        {o.where}
        <br />
        {o.howToJoin}
      </p>
    );
  }
  const v = TUESDAY_VENUE[en ? "en" : "zh"];
  return (
    <div className="stack-3">
      <p className="body" style={{ margin: 0 }}>
        {en ? "Time: " : "时间："}
        {TUESDAY_VENUE.start}–{TUESDAY_VENUE.end}
        <br />
        {en ? "Where: " : "地点："}
        {v.address}
        {en ? ". " : "。"}
        {v.directions}
        <br />
        <a href={TUESDAY_VENUE.mapsUrl} target="_blank" rel="noopener noreferrer">{v.mapsLabel} ↗</a>
      </p>
      <figure className="stack-2" style={{ margin: 0, maxWidth: "420px" }}>
        <a className="class-poster" href={TUESDAY_VENUE.directionsImage} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TUESDAY_VENUE.directionsThumb} width={874} height={1284} alt={v.directionsAlt} loading="lazy" />
        </a>
        <figcaption className="hint">{v.imageLabel}{en ? " — tap for the full image" : "：点开看大图"}</figcaption>
      </figure>
    </div>
  );
}
