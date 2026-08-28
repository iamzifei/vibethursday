/**
 * Darling Harbour behind the Wharf page: Pyrmont Bridge, the tall ship's masts
 * at the Maritime Museum, and the Anzac Bridge pylons beyond.
 *
 * ★ Not the Harbour Bridge and the Opera House. Those are on the home page, and
 * repeating them here would make the two pages look like one page — but the
 * better reason is that they are the wrong harbour. The meetup happens at
 * 35 Wheat Road, which is on Darling Harbour, about eighty metres from the
 * eastern end of Pyrmont Bridge. This page is named after a wharf; it should be
 * the wharf people are actually standing on.
 *
 * Same halftone technique as `SydneySkyline` — a dot pattern showing through a
 * silhouette mask — and the same reasons: a few hundred bytes of inline SVG,
 * no request, nothing to shift the layout while it loads, and at low opacity it
 * reads as texture rather than as a picture somebody has to look past.
 *
 * ⚠️ Everything that matters is drawn between x=130 and x=1035. On a phone the
 * band is wider than the screen and the overflow is clipped, so anything out
 * near the edges of the viewBox is simply not there for half the audience.
 *
 * ⚠️ Bold shapes only. The dot grid is 6 units across; a truss drawn as real
 * lattice, or cables drawn at their true thinness, dissolve into noise at this
 * size. What is here is stylised heavily enough to survive being 130px tall.
 *
 * Decorative only, so it is hidden from assistive tech and ignores pointers.
 */

/** Deck heights, kept as names because half the shapes below hang off them. */
const WATER = 216;
const DECK = 182;

/** Pyrmont Bridge runs across the middle; the swing span's tower is its middle. */
const BRIDGE_START = 130;
const BRIDGE_END = 700;
const BAY = 63.33; // nine bays, so the tower lands on a joint
const TOWER_X = 383;

export function DarlingHarbour() {
  const bays = Array.from({ length: 9 }, (_, i) => BRIDGE_START + i * BAY);
  const piles = Array.from({ length: 19 }, (_, i) => BRIDGE_START + 6 + i * 31);

  return (
    <svg
      className="skyline"
      viewBox="0 0 1200 250"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="vt-halftone-dh" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r="1.15" fill="currentColor" />
        </pattern>

        {/* A mask rather than filled shapes, so the dot grid stays aligned to
            the page instead of to each element — the same trick the home
            page's skyline uses, and the reason both read as one printed
            surface rather than as a collection of textures. */}
        <mask id="vt-dh-mask">
          <g fill="#fff">
            {/* ── Pyrmont Bridge ─────────────────────────────────── */}
            {/* Deck, and the timber piles under it. The bridge is long, low
                and repetitive, which is the whole difference between its
                silhouette and the Harbour Bridge's single arch. */}
            <rect x={BRIDGE_START} y={DECK} width={BRIDGE_END - BRIDGE_START} height={9} />
            {piles.map((x) => (
              <rect key={x} x={x} y={DECK + 9} width={5} height={WATER - DECK - 9} />
            ))}

            {/* Truss above the deck, as solid triangles. Real Allan trusses are
                open lattice; drawn honestly at this scale they turn to mush, so
                the web is filled and the rhythm carries the recognition. */}
            {bays.map((x) => (
              <path key={x} d={`M${x} ${DECK} L${x + BAY / 2} ${DECK - 26} L${x + BAY} ${DECK} Z`} />
            ))}
            {/* Top chord, tying the triangles into one structure. */}
            <rect x={BRIDGE_START} y={DECK - 30} width={BRIDGE_END - BRIDGE_START} height={5} />

            {/* The swing span's control cabin. The one thing on this bridge
                that is not repetition, so it carries most of the recognition:
                a small hipped-roof box up on a pier, roughly mid-span. */}
            <rect x={TOWER_X - 22} y={DECK + 9} width={44} height={WATER - DECK - 9} />
            <rect x={TOWER_X - 12} y={DECK - 44} width={24} height={44} />
            <rect x={TOWER_X - 23} y={DECK - 66} width={46} height={24} />
            <path d={`M${TOWER_X - 29} ${DECK - 66} L${TOWER_X} ${DECK - 82} L${TOWER_X + 29} ${DECK - 66} Z`} />
            <rect x={TOWER_X - 2} y={DECK - 98} width={4} height={17} />

            {/* ── Masts, moored off the Maritime Museum ──────────── */}
            {[726, 758, 788].map((x, i) => {
              const top = [118, 100, 128][i];
              return (
                <g key={x}>
                  <rect x={x} y={top} width={4} height={WATER - top} />
                  <rect x={x - 15} y={top + 26} width={34} height={3} />
                  <rect x={x - 11} y={top + 48} width={26} height={3} />
                </g>
              );
            })}
            {/* Hulls, so the masts are standing on something. */}
            <rect x={712} y={WATER - 12} width={96} height={12} />

            {/* ── Anzac Bridge, beyond ───────────────────────────── */}
            {/* Two A-frames with a cable fan each. The pylons are what people
                recognise; the cables are drawn thick enough to survive the
                halftone, which makes them coarser than life and legible. */}
            {/* Long enough to catch the outermost cable at each end: the fans reach
                90 units either side of an apex, so the deck has to run from
                888-90 to 982+90 or the cables end in mid-air. */}
            <rect x={790} y={DECK - 14} width={290} height={7} />
            {[888, 982].map((apex) => (
              <g key={apex}>
                {/* Legs, meeting at the top. Bolder than life so the A survives
                    the dot grid — thin legs plus a cable fan read as a fir
                    tree, which is what the first version drew. */}
                <path d={`M${apex - 21} ${DECK - 14} L${apex - 11} ${DECK - 14} L${apex + 3} ${64} L${apex - 4} ${64} Z`} />
                <path d={`M${apex + 21} ${DECK - 14} L${apex + 11} ${DECK - 14} L${apex - 3} ${64} L${apex + 4} ${64} Z`} />
                {/* ⚠️ Three cables a side, widely spaced. Four at 18px apart
                    filled the triangle solid and both pylons came out as
                    Christmas trees. The fan has to stay mostly empty to read
                    as a fan. */}
                {[1, 2, 3].map((n) => (
                  <g key={n}>
                    <path
                      d={`M${apex - 1} ${70 + n * 9} L${apex + 1} ${70 + n * 9} L${apex - 30 * n + 1.5} ${DECK - 14} L${apex - 30 * n - 1.5} ${DECK - 14} Z`}
                    />
                    <path
                      d={`M${apex - 1} ${70 + n * 9} L${apex + 1} ${70 + n * 9} L${apex + 30 * n - 1.5} ${DECK - 14} L${apex + 30 * n + 1.5} ${DECK - 14} Z`}
                    />
                  </g>
                ))}
              </g>
            ))}

            {/* ── Cockle Bay ─────────────────────────────────────── */}
            <rect x="0" y={WATER} width="1200" height="2" />
            <rect x="0" y={WATER + 12} width="1200" height="2" />
          </g>
        </mask>
      </defs>

      <rect width="1200" height="250" fill="url(#vt-halftone-dh)" mask="url(#vt-dh-mask)" />
    </svg>
  );
}
