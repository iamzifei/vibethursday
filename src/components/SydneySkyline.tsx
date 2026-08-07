/**
 * Sydney skyline behind the hero: the Harbour Bridge and the Opera House,
 * filled with a halftone dot grid rather than solid ink.
 *
 * Halftone rather than a photograph or a solid silhouette for three reasons:
 * it is a few hundred bytes of inline SVG so it costs no request and cannot
 * push the hero around while it loads; the dot grid echoes the printed-zine
 * feel of the numbered sections; and at low opacity it reads as texture, so
 * the hero text keeps its contrast on a phone where the two overlap.
 *
 * Decorative only, so it is hidden from assistive tech and ignores pointers.
 */
export function SydneySkyline() {
  return (
    <svg
      className="skyline"
      viewBox="0 0 1200 250"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="vt-halftone" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r="1.15" fill="currentColor" />
        </pattern>

        {/* The silhouette is a mask rather than a filled shape so the dot grid
            stays aligned to the page, not to each individual element. */}
        <mask id="vt-skyline-mask">
          <g fill="#fff">
            {/* ── Harbour Bridge ─────────────────────────────────── */}
            {/* Arch: outer curve out, inner curve back, giving it thickness. */}
            <path d="M96 200 C 150 96, 300 70, 330 70 C 360 70, 510 96, 564 200 L 540 200 C 490 116, 366 92, 330 92 C 294 92, 170 116, 120 200 Z" />
            {/* Deck */}
            <rect x="40" y="196" width="580" height="11" />
            {/* Pylons, one pair each side of the arch springing */}
            <rect x="112" y="150" width="34" height="57" />
            <rect x="514" y="150" width="34" height="57" />
            {/* Hangers */}
            <g>
              {[170, 210, 250, 290, 330, 370, 410, 450, 490].map((x) => (
                <rect key={x} x={x} y={94} width="3" height="104" />
              ))}
            </g>

            {/* ── Opera House ────────────────────────────────────── */}
            {/* Shells: each one a sail rising and curling to the right, the
                set stepping down towards the water like the real thing. */}
            <path d="M735 200 C 735 132, 772 84, 828 66 C 800 108, 792 154, 790 200 Z" />
            <path d="M800 200 C 800 142, 833 100, 884 84 C 858 122, 851 162, 849 200 Z" />
            <path d="M862 200 C 862 154, 890 120, 932 106 C 910 138, 904 170, 903 200 Z" />
            <path d="M916 200 C 916 168, 938 142, 970 132 C 953 156, 949 180, 948 200 Z" />
            {/* Podium */}
            <rect x="712" y="198" width="286" height="9" />

            {/* ── Waterline ──────────────────────────────────────── */}
            <rect x="0" y="216" width="1200" height="2" />
            <rect x="0" y="228" width="1200" height="2" />
          </g>
        </mask>
      </defs>

      <rect width="1200" height="250" fill="url(#vt-halftone)" mask="url(#vt-skyline-mask)" />
    </svg>
  );
}
