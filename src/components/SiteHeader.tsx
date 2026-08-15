import { SiteNav, type NavItem } from "@/components/SiteNav";
import type { Copy, Lang } from "@/lib/content";
import { langHref, NAV_CTA, NAV_LINKS } from "@/lib/nav";

type Props = {
  lang: Lang;
  copy: Copy;
  /** Where the language toggle goes — the current path in the other language. */
  switchHref: string;
};

/**
 * The bar every page opens with.
 *
 * A server component that does nothing but turn `NAV_LINKS` into labelled,
 * language-aware hrefs; the bar itself is `SiteNav`, which needs state for the
 * phone menu. The language toggle's destination is passed in rather than read
 * from the copy: on the home page it is "/", but on a member's page it has to
 * be that same member's page, or switching language would throw away where you
 * were.
 */
export function SiteHeader({ lang, copy, switchHref }: Props) {
  // The section anchors are written against the home page, so they work from
  // /members and /support as well as from the page they point into.
  const items: NavItem[] = NAV_LINKS.map((link) => ({
    href: langHref(link.href, lang),
    label: copy.nav[link.label],
  }));

  return (
    <SiteNav
      brand={copy.nav.brand}
      brandHref={langHref("/", lang)}
      items={items}
      cta={{ href: langHref(NAV_CTA.href, lang), label: copy.nav[NAV_CTA.label] }}
      switchHref={switchHref}
      switchLabel={copy.langSwitchLabel}
      switchLang={lang === "zh" ? "en" : "zh"}
      menuLabel={copy.nav.menu}
      skipLabel={copy.nav.skip}
    />
  );
}
