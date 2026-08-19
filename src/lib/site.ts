/**
 * The site's own address.
 *
 * Read at request time rather than baked in at build: sitemap.xml, robots.txt
 * and llms.txt all have to emit absolute URLs, and the build runs without
 * knowing where it is about to be deployed. The fallback is the production
 * domain, so a preview deployment without the variable set still emits valid
 * URLs — pointing at production, which is the safer of the two ways to be
 * wrong: a crawler following them lands on the real site rather than indexing
 * a preview under a throwaway hostname.
 */
export const FALLBACK_SITE_URL = "https://vibethursday.com";

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  // Trailing slashes are stripped here so every caller can write `${base}/path`
  // without producing a double slash.
  return (configured || FALLBACK_SITE_URL).replace(/\/+$/, "");
}

/**
 * Where this site's own code lives.
 *
 * The repository is public, so the footer can point at it: the clearest way to
 * say "this is a small hand-built thing, not a platform" is to let anyone read
 * it. Kept here beside the site's address because it is the same kind of fact
 * — where this thing is — and because a link in three footers should have one
 * source.
 */
export const SOURCE_URL = "https://github.com/iamzifei/vibethursday";

/**
 * The line in the footer, in English on every version of the site.
 *
 * Deliberately not translated and therefore not in `content.ts`. "Vibe-coded"
 * has no Chinese equivalent that keeps both halves of it — the closest
 * renderings either drop the joke or explain it, and a line whose whole job is
 * to sound offhand cannot survive being explained. It reads the same way to
 * this room in English, which is a room that types `git commit` all day.
 *
 * `{heart}` marks where the icon goes; the spaces around it are part of the
 * string so the gap is exactly one space. See `SiteFooter`.
 */
export const FOOTER_SLOGAN = "Vibe-coded in Sydney with {heart} and Claude";
