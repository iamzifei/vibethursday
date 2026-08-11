import {
  ARCH_PATH,
  BACKDROP,
  DECK,
  HANGERS,
  MARK_SIZE,
  PYLONS,
} from "@/lib/mark";

type Props = {
  /** Rendered width and height in pixels. The mark is square. */
  size?: number;
  /**
   * Draws the dark rounded square behind the bridge. On for a standalone icon
   * or avatar; off inline, where the page already supplies the background.
   */
  backdrop?: boolean;
  /** Given to the SVG when it carries meaning; omitted leaves it decorative. */
  title?: string;
};

/**
 * The Harbour Bridge mark.
 *
 * Inline it inherits `currentColor`, so it takes the accent from whatever it
 * sits next to instead of hard-coding a second copy of the palette. The
 * standalone icon does hard-code, because a PNG has no cascade to inherit
 * from — those two constants live in `@/lib/mark` next to the geometry.
 */
export function VibeThursdayMark({ size = 32, backdrop = false, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}

      {backdrop && (
        <rect
          width={MARK_SIZE}
          height={MARK_SIZE}
          rx={BACKDROP.radius}
          fill={BACKDROP.fill}
        />
      )}

      {/* One group, one fill: every part overlaps every other on purpose, so
          the whole bridge has to be a single colour or the seams show. */}
      <g fill="currentColor">
        {HANGERS.map((bar) => (
          <rect key={bar.x} {...bar} />
        ))}
        <path d={ARCH_PATH} />
        <rect {...DECK} />
        {PYLONS.map((pylon) => (
          <rect key={pylon.x} {...pylon} />
        ))}
      </g>
    </svg>
  );
}
