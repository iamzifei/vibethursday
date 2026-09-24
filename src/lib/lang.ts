// Relative imports only, and none at all: this file has to stay a leaf.
//
// ⚠️ Why it exists. These few constants used to live at the top of
// `content.ts`, and `content.ts` imports the Traditional Chinese converter at
// module level. The language switch in the header is a client component and
// needed three of these constants — so bundling it pulled the whole copy
// bundle for both languages AND the converter's dictionary into the browser.
// Measured on 2026-09-24: 452KB on the wire, 71% of every page's JavaScript,
// downloaded by every reader, including the ones who never switch to
// Traditional. The server had already rendered the Traditional page; the
// browser never needed the dictionary at all.
//
// Anything a client component needs about languages comes from here. Nothing
// here may import anything — `tests/lang-leaf.test.mts` holds that line.

/**
 * The three views of this site.
 *
 * Only two of them are written. `zh-Hant` is `zh` put through a character
 * converter at render time — see `@/lib/traditional` for why, and note that it
 * means everything below stays a two-language object.
 */
export type Lang = "zh" | "zh-Hant" | "en";

export const LANGS: Lang[] = ["zh", "zh-Hant", "en"];

/** The `?lang=` value for each. Simplified is the default and carries none. */
export const LANG_PARAM: Record<Lang, string | null> = {
  zh: null,
  "zh-Hant": "zh-Hant",
  en: "en",
};

/** What each calls itself, short enough for the switch in the nav bar. */
export const LANG_LABEL: Record<Lang, string> = {
  zh: "简",
  "zh-Hant": "繁",
  en: "EN",
};

/** The full name, for the switch's accessible labels. */
export const LANG_NAME: Record<Lang, string> = {
  zh: "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
};

export function resolveLang(value: string | undefined): Lang {
  // Case-insensitive: a link pasted into WeChat comes back lowercased often
  // enough that "zh-hant" has to mean the same thing as "zh-Hant".
  const normalised = value?.toLowerCase();

  if (normalised === "en") return "en";
  if (normalised === "zh-hant") return "zh-Hant";

  return "zh";
}
