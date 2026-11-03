/**
 * Where and when Build Tuesday happens (2026-11-02).
 *
 * The address is part of what paying for a Tuesday gets you, so it is kept
 * here and nowhere in the public copy (`content.ts`): the /tuesday page, the
 * footer and the comparison table only say "Chatswood". It is shown by the
 * `TuesdayVenue` component, which appears only on views of someone who has
 * paid, been let in free, or is a member — the payment page once paid, the
 * signup confirmation and /my. `tests/tuesday-venue.test.mts` keeps it that way.
 *
 * Not a secret: the venue is a public shopping centre. Hiding it is about how
 * the session is framed — it is something that costs money to attend — not
 * about stopping anyone who goes looking.
 */
export const TUESDAY_VENUE = {
  start: "10:30",
  end: "12:30",
  zh: {
    address: "Chatswood Lemon Grove 三楼 56 号铺（427–441 Victoria Ave，Westfield 正门对面）",
    directions: "火车站出来走主街约 100 米，泰椰奶花旁边的大门进，扶梯上 3 楼",
    directionsAlt: "从 Chatswood 火车站到 Lemon Grove 三楼 56 号铺的路线图：出站走到主街，约 100 米到泰椰奶花旁边的大门，进门扶梯上 3 楼",
    mapsLabel: "在地图上看",
    imageLabel: "路线图",
  },
  en: {
    address: "Lemon Grove, Level 3, Shop 56, 427–441 Victoria Ave, Chatswood (opposite the main entrance of Westfield)",
    directions: "From the station, walk along the mall about 100 m to the entrance next to the bubble tea shop, then take the escalator to level 3",
    directionsAlt: "Directions from Chatswood station to Lemon Grove, level 3, shop 56: walk along the mall about 100 m to the entrance next to the bubble tea shop, then the escalator to level 3",
    mapsLabel: "Open in Maps",
    imageLabel: "Directions",
  },
  mapsUrl: "https://maps.google.com/?q=Lemon+Grove+427-441+Victoria+Ave+Chatswood+NSW+2067",
  /**
   * The walking-directions picture, shown only in the views above. The files
   * stay at these URLs (James 2026-11-02): just never shown on a public page.
   */
  directionsImage: "/tuesday/directions.jpg",
  directionsThumb: "/tuesday/directions.webp",
} as const;
