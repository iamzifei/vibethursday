/**
 * The one description of what this project's pictures look like.
 *
 * ★ Every generated image on this site — the card faces behind the weekly
 * poster, the social card's background, the Wharf strip, each session's
 * painted poster — is compiled from the spine below. One file, so "unified"
 * is enforced at the source instead of being a thing three scripts each
 * promise separately.
 *
 * ⚠️ This reverses a deliberate earlier decision. `session-poster.mjs` used to
 * carry its own copy of the palette wording with a note saying it was repeated
 * rather than imported, so that two scripts run a year apart could not quietly
 * change each other's output. That reasoning was right for two unrelated
 * pictures and wrong for a set: the site ended up with four different image
 * languages that shared only a colour list, and a poster that read as a
 * masthead rather than as one of a series. The requirement now is the opposite
 * one — enforced consistency — so the duplication is gone on purpose.
 *
 * If this file changes, everything generated from it drifts away from
 * everything already committed. Regenerate the whole set or change nothing.
 */

/**
 * The model. `gpt-image-2.5` on its own does not exist — 实测 2026-09-24, the
 * API answers `The model 'gpt-image-2.5' does not exist.` The 2.5 family ships
 * as two named variants, and this is the one the set was chosen from:
 * `flare` simplifies into flat graphic shapes, `sunburst` keeps photographic
 * detail. At the size these are actually looked at — a thumbnail in a chat —
 * the simpler one is the one whose subject survives.
 */
export const MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2.5-flare";

/**
 * The two rules that are not style and are not negotiable.
 *
 * Textless, because every word on this site is real text rendered in three
 * languages — and because a model asked to paint Chinese invents characters
 * that are not characters. Faceless, because the site's own policy is that no
 * recognisable face appears in its pictures, and a model handed a scene will
 * cheerfully paint one in.
 */
export const RULES = [
  "Absolutely no text, no letters, no numbers, no words in any language, no logos,",
  "no watermarks, no signatures, no captions. The image is a textless plate —",
  "all typography is composited afterwards in code.",
  "No recognisable human faces.",
].join(" ");

/**
 * The house style, verbatim as the sample that was chosen from.
 *
 * Three things in here are doing structural work rather than decorating:
 *
 * - **The halftone that thins out upward.** It is what lets a silhouette end
 *   without an edge, so the picture dissolves into the page instead of
 *   stopping at a border. The first version of the weekly card drew a hard
 *   line under its art and read as a masthead because of it.
 * - **One object at 55-75%, cropped at an edge.** A picture of Sydney rather
 *   than a diagram of it.
 * - **The quiet lower third.** Not empty for taste: that band is where the
 *   composited type goes, and asking for it here is cheaper than fighting the
 *   picture for contrast afterwards.
 */
export const SPINE = [
  "A printed plate for a weekly meetup's collectible card. Flat, front-facing,",
  "no mockup, no frame, no desk, no cast shadow, no 3D depth.",
  "Strict palette: near-black ground (#0A0B0D), electric lime green (#C6FF3D) as",
  "the dominant ink, electric cyan (#3DDCFF) as a sparing second ink, cool dark",
  "grey mid-tones. No other hues — no magenta, no violet, no orange, none of the",
  "usual neon-noir colours.",
  "Treatment: the subject is reduced to a silhouette and reproduced as a halftone",
  "dot screen — visible dots at close range, the subject unmistakable at thumbnail",
  "size. Dots grow denser toward the base of the subject and thin out to nothing",
  "at the top, so the form dissolves into the dark ground rather than stopping at",
  "an edge. Thin luminous contour where the silhouette meets the ground.",
  "One dominant object occupying 55-75% of the frame, cropped decisively at one",
  "edge. The lower third is a quiet release zone: near-empty dark ground with two",
  "thin horizontal rules, so composited type can sit there.",
  "Screen-printed, mechanical, graphic. Not a painting, not an illustration with",
  "brush strokes, no airbrush gradient, no glow bloom, no lens flare.",
].join(" ");

/** Compiles one job into the prompt that is actually sent. */
export function prompt(subject) {
  return `${SPINE} ${subject} ${RULES}`;
}

/**
 * Asks for one image and returns the PNG bytes.
 *
 * `1024x1536` is the nearest portrait the API offers to the card's 3:4; the
 * caller crops. Quality is "high" because these are looked at full-screen on a
 * phone as often as they are looked at as thumbnails.
 */
export async function generate(subject, size = "1024x1536") {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, prompt: prompt(subject), size, quality: "high", n: 1 }),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const b64 = payload.data?.[0]?.b64_json;

  if (!b64) throw new Error("response contained no image data");

  return Buffer.from(b64, "base64");
}
