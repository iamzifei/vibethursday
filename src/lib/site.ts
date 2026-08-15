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
