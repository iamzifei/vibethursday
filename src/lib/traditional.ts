import { ConverterBuilder } from "opencc-js/core";
import * as Locale from "opencc-js/preset/cn2t";

/**
 * Traditional Chinese, derived rather than written.
 *
 * The site's copy is edited constantly — a venue line, a new FAQ answer, a
 * sentence that reads better the third time. A hand-written Traditional bundle
 * would be a third place to remember, and the one that gets forgotten: the
 * reader on the Traditional view would be the last to hear the venue changed.
 * So there are still exactly two written languages, and this converts one of
 * them at render time.
 *
 * `to: "tw"` and NOT `"twp"`: the `p` variants swap vocabulary as well as
 * characters (软件 → 軟體, 网络 → 網路). That is a rewrite of the voice by a
 * dictionary, on copy that was written a word at a time. Characters only.
 *
 * Server-side only. Every caller is a Server Component or a route handler, so
 * the dictionaries never reach the browser — the client receives finished
 * strings like it does for the other two languages.
 */
const convert = ConverterBuilder(Locale)({ from: "cn", to: "tw" });

/** One string. ASCII, URLs and the brand name pass through untouched. */
export function toTraditional(value: string): string {
  return convert(value);
}

/**
 * Every string inside a value, however deeply nested.
 *
 * Functions are wrapped rather than skipped: `gallery.photoCount` builds
 * "4 张" at call time, and a converted copy bundle that still says 张 in the
 * one place a number appears is exactly the kind of miss nobody reports.
 */
export function deepTranslate<T>(value: T): T {
  if (typeof value === "string") return convert(value) as T;

  if (Array.isArray(value)) return value.map((item) => deepTranslate(item)) as T;

  if (typeof value === "function") {
    return ((...args: unknown[]) => {
      const result = (value as (...a: unknown[]) => unknown)(...args);
      return typeof result === "string" ? convert(result) : result;
    }) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepTranslate(item)]),
    ) as T;
  }

  // Numbers, booleans, null, undefined.
  return value;
}
