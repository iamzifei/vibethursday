/**
 * The Vibe Thursday mark: the Harbour Bridge, reduced to what survives at 16px.
 *
 * The hero draws the same bridge as a halftone dot field, which is texture and
 * dissolves the moment it is scaled to a favicon. So the mark is the solid-ink
 * version of that drawing rather than a shrunken copy of it — same subject,
 * same silhouette, different weight, which is why the two read as one family
 * even though no pixel is shared.
 *
 * The pylons are not decoration. An arch over a deck is any bridge; an arch
 * with two stone blocks standing at its feet is *the* bridge, and blocks are
 * the one element that stays legible when the whole mark is 16 pixels wide.
 *
 * Geometry lives here rather than in the component so the icon build script
 * draws from the same numbers. Two copies of a path drift the first time one
 * of them is nudged.
 */

/** The mark is authored on a 512×512 grid and scaled by whoever renders it. */
export const MARK_SIZE = 512;

/**
 * The arch: outer curve up and over, inner curve back, closed into a band.
 *
 * Both feet land below the deck line so the deck reads as passing *through*
 * the arch rather than balancing on top of it.
 */
/**
 * The arch is drawn taller than the real bridge, and that is a favicon
 * decision rather than a drawing error.
 *
 * The real span rises about 0.27× its width — famously broad, hence "the
 * coathanger". Held to that, the mark fills barely half the height of a square
 * icon and at 16px it collapses into a green smear with nothing above the
 * deck. Stretched to roughly 0.6×, the arch still reads as an arch at every
 * size and stays unmistakable from 24px up, which is where a favicon actually
 * lives. Authenticity that is invisible at the size people see it is not
 * authenticity.
 */
export const ARCH_PATH =
  "M56 416 C56 190 156 96 256 96 C356 96 456 190 456 416 " +
  "L416 416 C416 219 336 145 256 145 C176 145 96 219 96 416 Z";

/**
 * The roadway, crossing the arch rather than sitting on it.
 *
 * This is the single most Harbour-Bridge-ish line in the drawing. The deck
 * runs through the arch about two thirds of the way down, leaving the legs to
 * continue below it to their footings. An arch that *ends* at its deck is a
 * viaduct; an arch the deck passes through is the coathanger.
 */
export const DECK = { x: 24, y: 312, width: 464, height: 38 };

/**
 * The two pylons, standing astride the arch feet.
 *
 * Wider than the arch band on purpose: they swallow the feet into one solid
 * block, which is what stops them fraying into fringe at small sizes. They
 * rise above the roadway and stop level with its underside, the way the stone
 * towers do — a pylon hanging below the deck reads as a pier, not a tower.
 */
export const PYLONS = [
  { x: 48, y: 229, width: 76, height: 187 },
  { x: 388, y: 229, width: 76, height: 187 },
];

/**
 * There are no suspender cables, and that is the design decision.
 *
 * The hero draws nine of them at 3px on a 468px span — hairlines, roughly half
 * a percent of the width each. Scaled into a 16px favicon that is a fifteenth
 * of a pixel. Drawing them anyway means fattening them ~5× out of proportion,
 * and three fat bars do not read as cables: they fill the one piece of
 * negative space that makes an arch look like an arch, and the mark turns into
 * a gateway. Ink drops hairlines; the arch keeps its opening.
 */
export const HANGERS: { x: number; y: number; width: number; height: number }[] = [];

/** Backdrop for the standalone icon. Matches --bg-primary and --radius-2xl. */
export const BACKDROP = { fill: "#0a0b0d", radius: 96 };

/** Matches --accent. */
export const MARK_COLOR = "#c6ff3d";
